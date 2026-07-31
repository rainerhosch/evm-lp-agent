import { config, computeDeployAmount, isDryRun } from "../config.js";
import { getWalletBalances } from "./wallet.js";
import { getTopCandidates, getPoolDetail, discoverPools } from "./screening.js";
import { deployPosition, getMyPositions, closePosition, claimFees } from "./univ3.js";
import { log, logAction } from "../logger.js";
import { checkExitRules } from "../risk.js";

const PROTECTED = new Set(["deploy_position", "close_position", "claim_fees"]);

const toolMap = {
  get_wallet_balance: getWalletBalances,
  get_top_candidates: getTopCandidates,
  discover_pools: discoverPools,
  get_pool_detail: getPoolDetail,
  get_my_positions: getMyPositions,
  deploy_position: deployPosition,
  close_position: closePosition,
  claim_fees: claimFees,
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
    return { native_balance: bal, deploy_amount: computeDeployAmount(bal), symbol: config.chain.nativeSymbol };
  },
};

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
    const positions = await getMyPositions({ force: true });
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
    logAction({ tool: name, args, success: result?.success !== false && !result?.error, duration_ms: Date.now() - start });
    return result;
  } catch (e) {
    logAction({ tool: name, args, success: false, error: e.message, duration_ms: Date.now() - start });
    return { error: e.message, tool: name };
  }
}

export { toolMap, checkExitRules };
