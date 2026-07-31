/**
 * Pool discovery via GeckoTerminal (no API key) for Uniswap / Pancake V3 style pools.
 */
import { config } from "../config.js";
import { scorePool } from "../risk.js";
import { log } from "../logger.js";
import { getGmgnTokenInfo, hasGmgnApiKey } from "./gmgn.js";

const GECKO = "https://api.geckoterminal.com/api/v2";

async function geckoFetch(path) {
  const res = await fetch(`${GECKO}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status}: ${await res.text()}`);
  return res.json();
}

function parsePool(item, network) {
  const a = item.attributes || {};
  const rel = item.relationships || {};
  const base = a.base_token_price_usd;
  const name = a.name || "unknown";
  const tvl = Number(a.reserve_in_usd || 0);
  const vol = Number(a.volume_usd?.h24 || a.volume_usd?.h6 || 0);
  // Fee APR proxy: volume * fee_tier / tvl — fee unknown → use 0.3% default for ranking
  const feePct = guessFeePct(a);
  const feeApr = tvl > 0 ? ((vol * (feePct / 100)) / tvl) * 365 * 100 : 0;

  const dexId = rel.dex?.data?.id || "";
  const isV3 =
    /uniswap.*v3|pancakeswap.*v3|pancake-v3|uniswap-v3/i.test(dexId) ||
    /v3/i.test(dexId);

  const baseTokenRaw = rel.base_token?.data?.id || "";
  const baseTokenAddr = baseTokenRaw.includes("_") ? baseTokenRaw.split("_")[1] : baseTokenRaw;

  return {
    pool: a.address,
    name,
    network,
    dex_id: dexId,
    is_v3: isV3,
    tvl_usd: Math.round(tvl),
    volume_24h_usd: Math.round(vol),
    fee_pct_guess: feePct,
    fee_apr_pct: Math.round(feeApr * 10) / 10,
    price_change_24h: Number(a.price_change_percentage?.h24 ?? 0),
    base_token_price_usd: base != null ? Number(base) : null,
    transactions_24h: Number(a.transactions?.h24?.buys || 0) + Number(a.transactions?.h24?.sells || 0),
    base_token_address: baseTokenAddr,
  };
}

function guessFeePct(attrs) {
  // Gecko may not always expose fee; default mid-tier 0.3%
  if (attrs.pool_fee_percentage != null) return Number(attrs.pool_fee_percentage);
  return 0.3;
}

/**
 * Top pools on the configured network, filtered for V3-like venues when possible.
 */
export async function discoverPools({ page = 1, limit = 20 } = {}) {
  const network = config.screening.geckoNetwork;
  const chainId = config.chain.id;

  // Guard: never silently screen a different chain's pools
  if (chainId === "robinhood" && network === "eth") {
    throw new Error(
      'Misconfigured screening: chain=robinhood but geckoNetwork=eth (Ethereum mainnet). Set geckoNetwork to "robinhood".',
    );
  }
  if (chainId === "ethereum" && network === "robinhood") {
    throw new Error(
      "Misconfigured screening: chain=ethereum but geckoNetwork=robinhood.",
    );
  }

  const data = await geckoFetch(
    `/networks/${network}/pools?page=${page}&sort=h24_volume_usd_desc`,
  );
  const items = Array.isArray(data.data) ? data.data : [];
  let pools = items.map((i) => parsePool(i, network));

  // Prefer V3 DEXes matching our registry
  const prefer =
    config.dex.id === "pancakeswap_v3"
      ? /pancake/i
      : /uniswap/i;

  const preferred = pools.filter((p) => prefer.test(p.dex_id));
  if (preferred.length >= 3) pools = preferred;

  // Soft-prefer is_v3 if gecko tags allow
  const v3 = pools.filter((p) => p.is_v3);
  if (v3.length >= 3) pools = v3;

  return {
    network,
    chain: config.chain.id,
    chain_id: config.chain.chainId,
    dex: config.dex.id,
    total: pools.length,
    pools: pools.slice(0, limit),
  };
}

export async function getTopCandidates({ limit = 10 } = {}) {
  const s = config.screening;
  const discovery = await discoverPools({ limit: Math.max(limit * 3, 30) });
  const filteredOut = [];

  const eligible = discovery.pools
    .filter((p) => {
      if (p.tvl_usd < s.minTvlUsd) {
        filteredOut.push({ name: p.name, reason: `TVL $${p.tvl_usd} < ${s.minTvlUsd}` });
        return false;
      }
      if (p.volume_24h_usd < s.minVolume24hUsd) {
        filteredOut.push({ name: p.name, reason: `vol $${p.volume_24h_usd} < ${s.minVolume24hUsd}` });
        return false;
      }
      if (p.fee_apr_pct < s.minFeeAprPct) {
        filteredOut.push({ name: p.name, reason: `fee APR ${p.fee_apr_pct}% < ${s.minFeeAprPct}%` });
        return false;
      }
      return true;
    });

  if (hasGmgnApiKey() && eligible.length > 0) {
    await Promise.allSettled(
      eligible.map(async (p) => {
        if (!p.base_token_address) return;
        const gmgnInfo = await getGmgnTokenInfo(p.base_token_address, config.chain.id);
        if (gmgnInfo) {
          p.gmgn = gmgnInfo;
          p.holders = gmgnInfo.holders;
          p.market_cap = gmgnInfo.market_cap;
        }
      })
    );
  }

  const screened = eligible.filter((p) => {
    if (p.gmgn) {
      if (p.gmgn.is_honeypot) {
        filteredOut.push({ name: p.name, reason: "GMGN: Honeypot" });
        return false;
      }
      if (p.gmgn.is_blacklisted) {
        filteredOut.push({ name: p.name, reason: "GMGN: Blacklisted" });
        return false;
      }
      if (p.gmgn.has_high_supply_concentration) {
        filteredOut.push({ name: p.name, reason: "GMGN: High top-10 concentration" });
        return false;
      }
    }
    return true;
  });

  const finalCandidates = screened
    .map((p) => ({ ...p, rank_score: scorePool(p) }))
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, limit);

  log(
    "screening",
    `${config.chain.id}/${config.dex.id}: ${eligible.length} candidates (${filteredOut.length} filtered)`,
  );

  return {
    chain: config.chain.id,
    dex: config.dex.id,
    candidates: finalCandidates,
    total_screened: discovery.pools.length,
    filtered_examples: filteredOut.slice(0, 5),
  };
}

export async function getPoolDetail({ pool_address }) {
  const network = config.screening.geckoNetwork;
  const data = await geckoFetch(`/networks/${network}/pools/${pool_address}`);
  if (!data.data) throw new Error(`Pool not found: ${pool_address}`);
  return parsePool(data.data, network);
}
