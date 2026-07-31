import { config, computeDeployAmount, isDryRun } from "../config.js";
import { getWalletBalances } from "./wallet.js";
import { getTopCandidates, getPoolDetail, discoverPools } from "./screening.js";
import { deployPosition, getMyPositions, closePosition, claimFees } from "./univ3.js";
import { log, logAction } from "../logger.js";
import { checkExitRules } from "../risk.js";
import { notifyDeploy, notifyClose } from "../telegram.js";

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
    const success = result?.success !== false && !result?.error && !result?.blocked;
    logAction({ tool: name, args, success, duration_ms: Date.now() - start });

    // Telegram side-effects (same idea as Meridian executor)
    if (success) {
      if (name === "deploy_position") {
        notifyDeploy({
          pair: result.pool_name || args.pool_name || args.pool_address,
          pool: result.pool || args.pool_address,
          amount_native: result.amount_native ?? args.amount_native,
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
