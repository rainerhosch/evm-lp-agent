/**
 * Multi-chain read helpers for Telegram / CLI.
 */
import { CHAINS } from "../chains/registry.js";
import { withChain, listChainIds, applyChain, getActiveChainId } from "../chain-runtime.js";
import { getWalletBalances } from "./wallet.js";
import { getMyPositions } from "./univ3.js";
import { getTopCandidates } from "./screening.js";
import { getNativeUsdPrice, nativeToUsd } from "./coingecko.js";
import { getOpenPositions } from "../state.js";
import { config, computeDeployAmount, isDryRun } from "../config.js";

export async function balanceOnChain(chainName) {
  return withChain(chainName, async () => {
    const bal = await getWalletBalances();
    const deploy = computeDeployAmount(bal.native || 0);
    const deployUsd = await nativeToUsd(deploy, config.chain).catch(() => ({ amount_usd: null }));
    return {
      ...bal,
      deploy_amount: deploy,
      deploy_amount_usd: deployUsd.amount_usd,
      dry_run: isDryRun(),
    };
  });
}

export async function balanceAllChains() {
  const chains = listChainIds();
  const rows = [];
  for (const id of chains) {
    try {
      rows.push(await balanceOnChain(id));
    } catch (e) {
      rows.push({ chain: id, error: e.message, native: 0, native_symbol: CHAINS[id]?.nativeSymbol });
    }
  }
  const total_usd = rows.reduce((s, r) => s + (Number(r.native_usd) || 0), 0);
  return { chains: rows, total_usd: Math.round(total_usd * 100) / 100 };
}

export async function positionsOnChain(chainName) {
  return withChain(chainName, async () => getMyPositions({ force: true }));
}

export async function positionsAllChains() {
  const open = getOpenPositions();
  // Group by chain; enrich age
  const byChain = {};
  for (const p of open) {
    const c = p.chain || "unknown";
    if (!byChain[c]) byChain[c] = [];
    const age_minutes = p.deployed_at
      ? Math.floor((Date.now() - new Date(p.deployed_at).getTime()) / 60000)
      : null;
    byChain[c].push({
      position: p.position_id,
      pair: p.pair,
      pool: p.pool,
      chain: c,
      dex: p.dex,
      amount_native: p.amount_native,
      amount_native_symbol: p.amount_native_symbol,
      fee: p.fee,
      tick_lower: p.tick_lower,
      tick_upper: p.tick_upper,
      dry_run: !!p.dry_run,
      age_minutes,
      pnl_pct: p.simulated_pnl_pct ?? 0,
      peak_pnl_pct: p.peak_pnl_pct ?? 0,
      trailing_active: !!p.trailing_active,
    });
  }
  const flat = [];
  for (const [chain, list] of Object.entries(byChain)) {
    list.forEach((p, i) => flat.push({ index: flat.length + 1, chain, ...p }));
  }
  return {
    total_positions: flat.length,
    by_chain: byChain,
    positions: flat,
  };
}

export async function candidatesOnChain(chainName, limit = 8) {
  return withChain(chainName, async () => getTopCandidates({ limit }));
}

export async function priceOnChain(chainName, amount = null) {
  return withChain(chainName, async () => {
    const px = await getNativeUsdPrice(config.chain);
    if (amount != null && Number.isFinite(Number(amount))) {
      const conv = await nativeToUsd(Number(amount), config.chain);
      return { chain: config.chain.id, ...px, amount_native: conv.amount_native, amount_usd: conv.amount_usd };
    }
    return { chain: config.chain.id, ...px };
  });
}

export async function switchActiveChain(chainName) {
  return applyChain(chainName);
}

export function formatBalanceLine(b) {
  if (b.error) return `${b.chain}: error ${b.error}`;
  const usd = b.native_usd != null ? ` ($${b.native_usd})` : "";
  const px = b.native_price_usd != null ? ` @$${b.native_price_usd}` : "";
  const dep =
    b.deploy_amount != null
      ? ` | next deploy ${b.deploy_amount} ${b.native_symbol}` +
        (b.deploy_amount_usd != null ? ` (~$${b.deploy_amount_usd})` : "")
      : "";
  return `${b.chain}: ${b.native} ${b.native_symbol}${usd}${px}${dep}`;
}

export function formatPositionsList(data, chainFilter = null) {
  let list = data.positions || [];
  if (chainFilter && chainFilter !== "all") {
    list = list.filter((p) => p.chain === chainFilter);
  }
  if (!list.length) return "No open positions.";
  return list
    .map((p, i) => {
      const n = p.index ?? i + 1;
      const dry = p.dry_run ? " 🧪" : "";
      const pnl = p.pnl_pct != null ? ` PnL ${p.pnl_pct}%` : "";
      return `${n}. [${p.chain}] ${p.pair}${dry}\n   ${p.amount_native ?? "?"} ${p.amount_native_symbol || ""} | ${p.age_minutes ?? "?"}m${pnl}\n   id: ${p.position}`;
    })
    .join("\n\n");
}

export { getActiveChainId, listChainIds };
