import { config, computeDeployAmount, isDryRun } from "../config.js";
import { getWalletBalances } from "./wallet.js";
import { getTopCandidates, getPoolDetail, discoverPools } from "./screening.js";
import { log, logAction } from "../logger.js";
import { checkExitRules } from "../risk.js";
import { notifyDeploy, notifyClose } from "../telegram.js";
import { getNativeUsdPrice, nativeToUsd, usdToNative } from "./coingecko.js";
import { confirmIndicatorPreset } from "./chart-indicators.js";
import { getPoolMemory } from "../pool-memory.js";
import { getPerformanceHistory } from "../lessons.js";

const PROTECTED = new Set(["deploy_position", "close_position", "claim_fees"]);

const toolMap = {
  get_wallet_balance: getWalletBalances,
  get_top_candidates: getTopCandidates,
  discover_pools: discoverPools,
  get_pool_detail: getPoolDetail,
  get_my_positions: async (args) => (await getDexAdapter()).getMyPositions(args),
  deploy_position: async (args) => (await getDexAdapter()).deployPosition(args),
  close_position: async (args) => (await getDexAdapter()).closePosition(args),
  claim_fees: async (args) => (await getDexAdapter()).claimFees(args),
  get_chart_indicators: confirmIndicatorPreset,
  get_pool_memory: getPoolMemory,
  get_performance_history: getPerformanceHistory,
  get_native_price: async () => getNativeUsdPrice(config.chain),
  get_config: async () => ({
    chain: config.chain,
    dex: { id: config.dex.id, name: config.dex.name },
    dry_run: isDryRun(),
    management: config.management,
    risk: config.risk,
    screening: config.screening,
  }),
  compute_deploy_amount: async ({ native_balance } = {}) => {
    const bal = native_balance ?? (await getWalletBalances()).native;
    const deploy_amount = computeDeployAmount(bal);
    const usd = await nativeToUsd(deploy_amount, config.chain);
    return {
      native_balance: bal,
      deploy_amount,
      deploy_amount_usd: usd.amount_usd,
      native_price_usd: usd.price_usd,
      symbol: config.chain.nativeSymbol,
    };
  },
  convert_native_usd: async ({ amount_native, amount_usd } = {}) => {
    if (amount_usd != null) return usdToNative(amount_usd, config.chain);
    return nativeToUsd(amount_native, config.chain);
  },
};

async function getDexAdapter() {
  if (config.dex.kind === "univ4") {
    return await import("./univ4.js");
  }
  return await import("./univ3.js");
}

async function runSafetyChecks(name, args) {
  if (name === "deploy_position") {
    if (!args.pool_address) return { pass: false, reason: "pool_address required" };
    const amount = Number(args.amount_native ?? config.management.deployAmountNative);
    if (!Number.isFinite(amount) || amount < 0.005) {
      return { pass: false, reason: `amount_native ${amount} too small (min 0.005)` };
    }
    if (amount > config.risk.maxDeployAmount) {
      return { pass: false, reason: `amount exceeds maxDeployAmount` };
    }
    const adapter = await getDexAdapter();
    const positions = await adapter.getMyPositions({ force: true });
    if (positions.total_positions >= config.risk.maxPositions) {
      return { pass: false, reason: `maxPositions ${config.risk.maxPositions} reached` };
    }
    if (!isDryRun()) {
      const bal = await getWalletBalances();
      if (bal.native < amount + config.management.gasReserve) {
        return {
          pass: false,
          reason: `Insufficient ${config.chain.nativeSymbol}: ${bal.native} < ${amount + config.management.gasReserve}`,
        };
      }
    }
  }
  return { pass: true };
}

export async function executeTool(name, args = {}) {
  const start = Date.now();
  name = String(name).replace(/<.*$/, "").trim();
  const fn = toolMap[name];
  if (!fn) return { error: `Unknown tool: ${name}` };

  if (PROTECTED.has(name)) {
    const safety = await runSafetyChecks(name, args);
    if (!safety.pass) {
      log("safety_block", `${name}: ${safety.reason}`);
      return { blocked: true, reason: safety.reason };
    }
  }

  try {
    const result = await fn(args);
    const success = result?.success !== false && !result?.error && !result?.blocked;
    logAction({ tool: name, args, success, duration_ms: Date.now() - start });

    // Telegram side-effects (same idea as Meridian executor)
    if (success) {
      if (name === "deploy_position") {
        const amt = result.amount_native ?? args.amount_native;
        let amount_usd = null;
        let native_price_usd = null;
        try {
          const conv = await nativeToUsd(amt, config.chain);
          amount_usd = conv.amount_usd;
          native_price_usd = conv.price_usd;
        } catch { /* ignore price miss */ }
        notifyDeploy({
          pair: result.pool_name || args.pool_name || args.pool_address,
          pool: result.pool || args.pool_address,
          amount_native: amt,
          amount_usd,
          native_price_usd,
          native_symbol: config.chain.nativeSymbol,
          position_id: result.position_id,
          fee: result.fee ?? args.fee,
          tick_lower: result.tick_lower,
          tick_upper: result.tick_upper,
          chain: config.chain.name || config.chain.id,
          dex: config.dex.name || config.dex.id,
          dry_run: !!(result.dry_run || isDryRun()),
          tx: result.tx || result.txs?.[0] || null,
          explorer: config.chain.explorer || null,
        }).catch((e) => log("telegram_warn", e.message));
      } else if (name === "close_position") {
        notifyClose({
          pair: result.pair || args.position_id,
          position_id: result.position_id || args.position_id,
          reason: args.reason || result.reason || "",
          pnl_pct: result.pnl_pct ?? null,
          chain: config.chain.name || config.chain.id,
          dry_run: !!(result.dry_run || isDryRun()),
          tx: result.tx || null,
        }).catch((e) => log("telegram_warn", e.message));
      }
    }

    return result;
  } catch (e) {
    logAction({ tool: name, args, success: false, error: e.message, duration_ms: Date.now() - start });
    return { error: e.message, tool: name };
  }
}

export { toolMap, checkExitRules };
