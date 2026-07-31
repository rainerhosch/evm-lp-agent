import fs from "fs";
import dotenv from "dotenv";
import { repoPath } from "./repo-root.js";
import { resolveChain, resolveDex } from "./chains/registry.js";

dotenv.config({ path: repoPath(".env") });

const USER_CONFIG_PATH = repoPath("user-config.json");
const u = fs.existsSync(USER_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"))
  : {};

if (u.dryRun !== undefined) process.env.DRY_RUN ||= String(u.dryRun);
if (u.chain) process.env.EVM_CHAIN ||= u.chain;
if (u.llmModel) process.env.LLM_MODEL ||= u.llmModel;
if (u.llmBaseUrl) process.env.LLM_BASE_URL ||= u.llmBaseUrl;
if (u.llmApiKey) process.env.LLM_API_KEY ||= u.llmApiKey;

const chainName = process.env.EVM_CHAIN || u.chain || "ethereum";
const chain = resolveChain(chainName);
const dex = resolveDex(chain, u.dex || "auto");

const rpcFromUser = u.rpcUrls?.[chain.id];
const envRpcKey = {
  ethereum: "ETH_RPC_URL",
  bsc: "BSC_RPC_URL",
  base: "BASE_RPC_URL",
  arbitrum: "ARB_RPC_URL",
  robinhood: "RH_RPC_URL"
}[chain.id];

export const config = {
  dryRun: process.env.DRY_RUN === "true" || u.dryRun === true,

  chain,
  dex,

  rpcUrl:
    process.env[envRpcKey] ||
    rpcFromUser ||
    process.env.RPC_URL ||
    defaultRpc(chain.id),

  privateKey: process.env.EVM_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || "",

  risk: {
    maxPositions: u.maxPositions ?? 1,
    maxDeployAmount: u.maxDeployAmount ?? 0.05,
  },

  management: {
    deployAmountNative: u.deployAmountNative ?? 0.015,
    gasReserve: u.gasReserve ?? 0.006,
    positionSizePct: u.positionSizePct ?? 0.75,
    minNativeToOpen: u.minNativeToOpen ?? 0.02,
    stopLossPct: u.stopLossPct ?? -25,
    takeProfitPct: u.takeProfitPct ?? 8,
    trailingTakeProfit: u.trailingTakeProfit ?? true,
    trailingTriggerPct: u.trailingTriggerPct ?? 3,
    trailingDropPct: u.trailingDropPct ?? 1.5,
    hardTakeProfitWhileTrailing: u.hardTakeProfitWhileTrailing ?? false,
    outOfRangeWaitMinutes: u.outOfRangeWaitMinutes ?? 30,
    maxHoldMinutes: u.maxHoldMinutes ?? 360,
    minClaimAmountUsd: u.minClaimAmountUsd ?? 1,
    dailyLossLimitEnabled: u.dailyLossLimitEnabled ?? true,
    dailyLossLimitNative: u.dailyLossLimitNative ?? 0.01,
    feeTiers: u.feeTiers ?? dex.feeTiers,
    tickRangeWidth: u.tickRangeWidth ?? 60,
    preferStableQuote: u.preferStableQuote ?? true,
  },

  screening: {
    // Chain-specific defaults (e.g. robinhood has thinner books than mainnet)
    minTvlUsd: u.minTvlUsd ?? chain.screeningDefaults?.minTvlUsd ?? 50_000,
    minVolume24hUsd: u.minVolume24hUsd ?? chain.screeningDefaults?.minVolume24hUsd ?? 20_000,
    minFeeAprPct: u.minFeeAprPct ?? chain.screeningDefaults?.minFeeAprPct ?? 5,
    maxTopPoolRank: u.maxTopPoolRank ?? 50,
    // Must match GeckoTerminal network id for THIS chain (never reuse eth for L2s)
    geckoNetwork: u.geckoNetwork || chain.geckoNetwork,
  },

  schedule: {
    managementIntervalMin: u.managementIntervalMin ?? 10,
    screeningIntervalMin: u.screeningIntervalMin ?? 30,
  },

  llm: {
    temperature: u.temperature ?? 0.3,
    maxTokens: u.maxTokens ?? 4096,
    maxSteps: u.maxSteps ?? 12,
    // OpenRouter OpenAI-compatible API — https://openrouter.ai/docs
    baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "",
    // Free Models Router — picks free models that support tools/etc.
    // https://openrouter.ai/openrouter/free
    defaultModel: u.llmModel || process.env.LLM_MODEL || "openrouter/free",
    screeningModel:
      u.screeningModel || process.env.LLM_MODEL || "openrouter/free",
    managementModel:
      u.managementModel || process.env.LLM_MODEL || "openrouter/free",
    generalModel:
      u.generalModel || process.env.LLM_MODEL || "openrouter/free",
    // Reasoning tokens — https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
    // true | false | { enabled, effort, max_tokens, exclude }
    reasoningEnabled: u.reasoningEnabled ?? true,
    reasoning:
      u.reasoning === false
        ? false
        : u.reasoning && typeof u.reasoning === "object"
          ? u.reasoning
          : {
              enabled: u.reasoningEnabled ?? true,
              effort: u.reasoningEffort || process.env.OPENROUTER_REASONING_EFFORT || "medium",
              exclude: u.reasoningExclude ?? false,
            },
    reasoningEffort: u.reasoningEffort || process.env.OPENROUTER_REASONING_EFFORT || "medium",
    logReasoning: u.logReasoning ?? true,
    // Optional leaderboard attribution
    httpReferer: u.openRouterHttpReferer || process.env.OPENROUTER_HTTP_REFERER || "https://github.com/evm-lp-agent",
    appTitle: u.openRouterAppTitle || process.env.OPENROUTER_APP_TITLE || "evm-lp-agent",
    provider: u.openRouterProvider || null,
  },

  graphApiKey: process.env.GRAPH_API_KEY || u.graphApiKey || "",
};

function defaultRpc(id) {
  return {
    ethereum: "https://ethereum.publicnode.com",
    bsc: "https://bsc-dataseed.binance.org",
    base: "https://mainnet.base.org",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    robinhood: "https://rpc.mainnet.chain.robinhood.com"
  }[id];
}

/**
 * Size a deploy in native units (ETH/BNB).
 * clamp( (balance - gasReserve) * pct , floor, ceil )
 */
export function computeDeployAmount(walletNative) {
  const reserve = config.management.gasReserve ?? 0.006;
  const pct = config.management.positionSizePct ?? 0.75;
  const floor = config.management.deployAmountNative ?? 0.015;
  const ceil = config.risk.maxDeployAmount ?? 0.05;
  const deployable = Math.max(0, walletNative - reserve);
  const dynamic = deployable * pct;
  const result = Math.min(ceil, Math.max(floor, dynamic));
  return parseFloat(result.toFixed(6));
}

export function isDryRun() {
  return process.env.DRY_RUN === "true" || config.dryRun === true;
}
