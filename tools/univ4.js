/**
 * Uniswap V4 position adapter (concentrated liquidity + hooks).
 * Live mint is gated; dry-run fully simulates and records state.
 */
import { ethers } from "ethers";
import { config, isDryRun, computeDeployAmount } from "../config.js";
import { getProvider, getWallet, getWalletBalances } from "./wallet.js";
import { trackPosition, getOpenPositions, recordClose, getTrackedPosition, updatePeak, markOutOfRange, minutesOutOfRange } from "../state.js";
import { log } from "../logger.js";
// Re-using NPM ABI for scaffold readability, though V4 PositionManager differs
import npmAbi from "../abis/npm.json" with { type: "json" };

function v4PositionManagerContract(signerOrProvider) {
  return new ethers.Contract(config.dex.positionManagerAddress, npmAbi, signerOrProvider);
}

/**
 * Deploy concentrated liquidity in Uniswap V4.
 */
export async function deployPosition({
  pool_address,
  pool_name,
  amount_native,
  fee = 3000,
  tick_range_width,
  token0,
  token1,
  hook_address, // V4 specific
}) {
  const bal = await getWalletBalances();
  const amount = amount_native != null
    ? Number(amount_native)
    : computeDeployAmount(bal.native || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Invalid amount_native" };
  }
  if (amount > config.risk.maxDeployAmount) {
    return { success: false, error: `amount ${amount} > maxDeployAmount ${config.risk.maxDeployAmount}` };
  }
  if (!isDryRun() && (bal.native || 0) < amount + config.management.gasReserve) {
    return {
      success: false,
      error: `Insufficient ${config.chain.nativeSymbol}: have ${bal.native}, need ${amount + config.management.gasReserve}`,
    };
  }

  const open = getOpenPositions().filter((p) => p.chain === config.chain.id);
  if (open.length >= config.risk.maxPositions) {
    return { success: false, error: `maxPositions ${config.risk.maxPositions} reached` };
  }

  const width = tick_range_width ?? config.management.tickRangeWidth;
  const half = Math.floor(width / 2);

  if (isDryRun()) {
    const fakeId = `dry-v4-${config.chain.id}-${Date.now().toString(36)}`;
    const pos = trackPosition({
      position_id: fakeId,
      token_id: fakeId,
      chain: config.chain.id,
      dex: config.dex.id,
      pool: pool_address,
      pair: pool_name || pool_address?.slice(0, 10),
      fee,
      tick_lower: -half,
      tick_upper: half,
      amount_native: amount,
      amount_native_symbol: config.chain.nativeSymbol,
      token0: token0 || null,
      token1: token1 || null,
      dry_run: true,
      trailing_trigger_pct: config.management.trailingTriggerPct,
    });
    log("deploy", `DRY RUN V4 mint ${pos.pair} ${amount} ${config.chain.nativeSymbol} (hook: ${hook_address || "none"})`);
    return {
      success: true,
      dry_run: true,
      position_id: fakeId,
      pool: pool_address,
      pool_name: pos.pair,
      amount_native: amount,
      fee,
      tick_lower: -half,
      tick_upper: half,
      message: "DRY RUN — no on-chain transaction sent (V4 Simulated)",
    };
  }

  return {
    success: false,
    error:
      "Live mint for Uniswap V4 is scaffolded. V4 requires interacting with the PoolManager singleton and resolving hook dependencies before PositionManager minting. Set DRY_RUN=true for simulation.",
    hint: {
      positionManager: config.dex.positionManagerAddress,
      poolManager: config.dex.poolManagerAddress,
      chainId: config.chain.chainId,
      amount,
      fee,
      hook: hook_address || "0x0000000000000000000000000000000000000000",
    },
  };
}

export async function getMyPositions({ force = false } = {}) {
  const tracked = getOpenPositions().filter((p) => p.chain === config.chain.id && p.dex === "uniswap_v4");

  const positions = tracked.map((p) => {
    const age_minutes = p.deployed_at
      ? Math.floor((Date.now() - new Date(p.deployed_at).getTime()) / 60000)
      : null;
    const pnl_pct = p.simulated_pnl_pct ?? 0;
    updatePeak(p.position_id, pnl_pct);
    const in_range = p.simulated_in_range !== false;
    markOutOfRange(p.position_id, !in_range);
    return {
      position: p.position_id,
      token_id: p.token_id,
      pair: p.pair,
      pool: p.pool,
      chain: p.chain,
      dex: p.dex,
      fee: p.fee,
      tick_lower: p.tick_lower,
      tick_upper: p.tick_upper,
      amount_native: p.amount_native,
      age_minutes,
      pnl_pct,
      peak_pnl_pct: getTrackedPosition(p.position_id)?.peak_pnl_pct ?? 0,
      trailing_active: getTrackedPosition(p.position_id)?.trailing_active ?? false,
      in_range,
      minutes_out_of_range: minutesOutOfRange(p.position_id),
      unclaimed_fees_usd: 0,
      dry_run: !!p.dry_run,
    };
  });

  let onchain_count = null;
  if (!isDryRun() || force) {
    try {
      const wallet = getWallet();
      const pm = v4PositionManagerContract(getProvider());
      const bal = await pm.balanceOf(wallet.address);
      onchain_count = Number(bal);
    } catch {
      onchain_count = null;
    }
  }

  return {
    wallet: (() => {
      try {
        return getWallet().address;
      } catch {
        return null;
      }
    })(),
    chain: config.chain.id,
    dex: config.dex.id,
    total_positions: positions.length,
    onchain_nft_count: onchain_count,
    positions,
  };
}

export async function closePosition({ position_id, reason = "manual" }) {
  const tracked = getTrackedPosition(position_id);
  if (!tracked || tracked.closed) {
    return { success: false, error: `Position ${position_id} not found or already closed` };
  }

  if (tracked.dry_run || isDryRun()) {
    recordClose(position_id, reason);
    return {
      success: true,
      dry_run: true,
      position_id,
      reason,
      message: "DRY RUN close (V4) — state updated only",
    };
  }

  return {
    success: false,
    error: "Live close for V4 not fully wired — requires StateView & PositionManager logic.",
    position_id,
  };
}

export async function claimFees({ position_id }) {
  if (isDryRun()) {
    return { success: true, dry_run: true, position_id, fees_usd: 0, message: "DRY RUN claim (V4)" };
  }
  return { success: false, error: "Live claim for V4 not fully wired." };
}
