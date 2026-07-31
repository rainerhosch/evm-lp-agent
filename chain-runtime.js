/**
 * Multi-chain runtime switcher.
 * Config is a mutable singleton; Telegram/CLI can temporarily target another chain.
 */
import { config } from "./config.js";
import { resolveChain, resolveDex, CHAINS, listSupportedMarkets } from "./chains/registry.js";
import { log } from "./logger.js";

let _walletReset = null;
let _providerReset = null;

/** Register cache clearers from wallet.js to avoid circular imports at load. */
export function registerWalletResets({ resetProvider, resetWallet }) {
  _providerReset = resetProvider;
  _walletReset = resetWallet;
}

function rpcFor(chain) {
  const envKey = {
    ethereum: "ETH_RPC_URL",
    bsc: "BSC_RPC_URL",
    base: "BASE_RPC_URL",
    arbitrum: "ARB_RPC_URL",
    robinhood: "RH_RPC_URL",
  }[chain.id];
  return (
    process.env[envKey] ||
    process.env.RPC_URL ||
    {
      ethereum: "https://ethereum.publicnode.com",
      bsc: "https://bsc-dataseed.binance.org",
      base: "https://mainnet.base.org",
      arbitrum: "https://arb1.arbitrum.io/rpc",
      robinhood: "https://rpc.mainnet.chain.robinhood.com",
    }[chain.id]
  );
}

/**
 * Snapshot of current active chain runtime.
 */
export function getActiveChainId() {
  return config.chain?.id || "ethereum";
}

export function listChainIds() {
  return Object.keys(CHAINS);
}

export function isValidChain(name) {
  if (!name || name === "all") return true;
  try {
    resolveChain(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Switch process-wide active chain (for screening/deploy tools that read config).
 */
export function applyChain(chainName) {
  const chain = resolveChain(chainName);
  const dex = resolveDex(chain, "auto");
  config.chain = chain;
  config.dex = dex;
  config.rpcUrl = rpcFor(chain);
  config.screening = {
    ...config.screening,
    geckoNetwork: chain.geckoNetwork,
    minTvlUsd: chain.screeningDefaults?.minTvlUsd ?? config.screening.minTvlUsd,
    minVolume24hUsd: chain.screeningDefaults?.minVolume24hUsd ?? config.screening.minVolume24hUsd,
    minFeeAprPct: chain.screeningDefaults?.minFeeAprPct ?? config.screening.minFeeAprPct,
  };
  process.env.EVM_CHAIN = chain.id;
  _providerReset?.();
  _walletReset?.();
  log("chain", `Active chain → ${chain.name} (${chain.id}/${chain.chainId}) dex=${dex.id}`);
  return { chain, dex, rpcUrl: config.rpcUrl };
}

/**
 * Switch process-wide active DEX (for switching between V3 and V4).
 */
export function applyDex(dexId) {
  const chain = config.chain || resolveChain("ethereum");
  const dex = resolveDex(chain, dexId);
  config.dex = dex;
  log("chain", `Active dex → ${dex.name} on ${chain.name}`);
  return { chain, dex };
}

/**
 * Run async work on a chain, then restore previous chain.
 */
export async function withChain(chainName, fn) {
  const prev = getActiveChainId();
  if (chainName && chainName !== "all" && chainName !== prev) {
    applyChain(chainName);
  }
  try {
    return await fn({ chain: config.chain, dex: config.dex });
  } finally {
    if (chainName && chainName !== "all" && chainName !== prev) {
      try {
        applyChain(prev);
      } catch {
        /* ignore restore errors */
      }
    }
  }
}

/**
 * Parse "--chain bsc" or "chain=bsc" or trailing token from telegram text.
 * Returns { chain: string|null|'all', rest: string, args: string[] }
 */
export function parseChainArgs(text) {
  const raw = String(text || "").trim();
  // strip bot mention
  const cleaned = raw.replace(/@\w+/g, "").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  let chain = null;
  const rest = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "--chain" || t === "-c" || t === "chain") {
      const next = tokens[i + 1];
      if (next) {
        chain = next.toLowerCase().replace(/^--/, "");
        i++;
        continue;
      }
    }
    const m = t.match(/^--chain=(.+)$/i) || t.match(/^chain=(.+)$/i);
    if (m) {
      chain = m[1].toLowerCase();
      continue;
    }
    rest.push(t);
  }
  // Also allow: /balance bsc
  if (!chain && rest[1] && isValidChain(rest[1].toLowerCase())) {
    chain = rest[1].toLowerCase();
    rest.splice(1, 1);
  }
  if (chain === "all" || chain === "*") chain = "all";
  return { chain, rest, command: (rest[0] || "").toLowerCase(), args: rest.slice(1) };
}

export function marketsHelp() {
  return listSupportedMarkets()
    .map((m) => `• ${m.chain} → ${m.dex} (${m.note})`)
    .join("\n");
}
