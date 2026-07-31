/**
 * Daemon entry — screening + management cycles for EVM LP agent.
 */
import cron from "node-cron";
import { config, computeDeployAmount, isDryRun } from "./config.js";
import { agentLoop } from "./agent.js";
import { getWalletBalances } from "./tools/wallet.js";
import { getMyPositions, closePosition } from "./tools/univ3.js";
import { getTopCandidates } from "./tools/screening.js";
import { checkExitRules } from "./risk.js";
import { getTrackedPosition, updatePeak } from "./state.js";
import { log } from "./logger.js";
import { listSupportedMarkets } from "./chains/registry.js";
import {
  isEnabled as telegramEnabled,
  notifyScreen,
  notifyManage,
  notifyClose,
  sendHTML,
} from "./telegram.js";

let _screenBusy = false;
let _manageBusy = false;

function classifyScreenReport(content) {
  const t = String(content || "");
  if (/skip:/i.test(t)) return "skip";
  if (/fail|error/i.test(t) && !/deploy/i.test(t)) return "error";
  if (/no deploy|⛔/i.test(t)) return "no_deploy";
  if (/deployed|🚀|✅/i.test(t)) return "deployed";
  return "no_deploy";
}

export async function runScreeningCycle({ silent = false } = {}) {
  if (_screenBusy) {
    log("cron", "Screening skipped — busy");
    return "busy";
  }
  _screenBusy = true;
  try {
    const bal = await getWalletBalances();
    const positions = await getMyPositions({ force: true });
    if (positions.total_positions >= config.risk.maxPositions) {
      const msg = `Skip: max positions (${positions.total_positions})`;
      if (telegramEnabled()) {
        await notifyScreen({
          chain: config.chain.id,
          dex: config.dex.id,
          status: "skip",
          summary: msg,
          dry_run: isDryRun(),
        }).catch(() => {});
      }
      return msg;
    }
    const need = config.management.deployAmountNative + config.management.gasReserve;
    if (!isDryRun() && (bal.native || 0) < need) {
      const msg = `Skip: insufficient ${config.chain.nativeSymbol} (${bal.native} < ${need})`;
      if (telegramEnabled()) {
        await notifyScreen({
          chain: config.chain.id,
          dex: config.dex.id,
          status: "skip",
          summary: msg,
          dry_run: isDryRun(),
        }).catch(() => {});
      }
      return msg;
    }

    const deploy = computeDeployAmount(bal.native || 0);
    log("cron", `Screen ${config.chain.id}/${config.dex.id} deploy≈${deploy} ${config.chain.nativeSymbol}`);

    const top = await getTopCandidates({ limit: 8 });
    const blocks = (top.candidates || [])
      .map(
        (c, i) =>
          `[${i + 1}] ${c.name} pool=${c.pool} tvl=$${c.tvl_usd} vol24=$${c.volume_24h_usd} feeAPR≈${c.fee_apr_pct}% score=${c.rank_score?.toFixed?.(1) ?? c.rank_score}`,
      )
      .join("\n");

    const goal = `SCREENING CYCLE (${config.chain.name} / ${config.dex.name})
DRY_RUN=${isDryRun()}
Wallet ${bal.wallet} balance=${bal.native} ${config.chain.nativeSymbol}
Deploy amount: ${deploy} ${config.chain.nativeSymbol}
maxPositions=${config.risk.maxPositions}

CANDIDATES:
${blocks || "none"}

Pick best pool and call deploy_position with full pool_address, pool_name, amount_native=${deploy}.
If no good candidate: reply NO DEPLOY with reasons.`;

    const { content } = await agentLoop(goal, config.llm.maxSteps, [], "SCREENER");
    if (!silent) console.log(content);

    // Deploy success already notifies via executor.notifyDeploy.
    // Still send cycle summary for NO DEPLOY / errors (not for pure deployed to avoid double spam).
    if (telegramEnabled()) {
      const status = classifyScreenReport(content);
      if (status !== "deployed") {
        await notifyScreen({
          chain: config.chain.id,
          dex: config.dex.id,
          status,
          summary: content,
          dry_run: isDryRun(),
        }).catch(() => {});
      }
    }
    return content;
  } catch (e) {
    log("cron_error", e.message);
    if (telegramEnabled()) {
      await notifyScreen({
        chain: config.chain.id,
        dex: config.dex.id,
        status: "error",
        summary: e.message,
        dry_run: isDryRun(),
      }).catch(() => {});
    }
    return `Screening failed: ${e.message}`;
  } finally {
    _screenBusy = false;
  }
}

export async function runManagementCycle({ silent = false } = {}) {
  if (_manageBusy) return "busy";
  _manageBusy = true;
  try {
    const snap = await getMyPositions({ force: true });
    if (!snap.positions?.length) {
      log("cron", "No positions — optional screen");
      runScreeningCycle({ silent: true }).catch(() => {});
      return "No open positions";
    }

    const actions = [];
    for (const p of snap.positions) {
      updatePeak(p.position, p.pnl_pct);
      const tracked = getTrackedPosition(p.position);
      const enriched = {
        ...p,
        peak_pnl_pct: tracked?.peak_pnl_pct ?? p.peak_pnl_pct,
        trailing_active: tracked?.trailing_active ?? p.trailing_active,
      };
      const rule = checkExitRules(enriched, config.management);
      if (rule?.action === "CLOSE") {
        const r = await closePosition({ position_id: p.position, reason: rule.reason });
        actions.push({ pair: p.pair, ...rule, result: r });
        // Direct close path (not via executor) — notify here
        if (r?.success && telegramEnabled()) {
          await notifyClose({
            pair: p.pair,
            position_id: p.position,
            reason: rule.reason,
            pnl_pct: p.pnl_pct,
            chain: config.chain.id,
            dry_run: !!(r.dry_run || isDryRun()),
            tx: r.tx || null,
          }).catch(() => {});
        }
      }
    }

    const report =
      actions.length > 0
        ? actions.map((a) => `${a.pair}: CLOSE (${a.reason})`).join("\n")
        : "All positions STAY";
    if (!silent) console.log(report);
    if (telegramEnabled() && actions.length > 0) {
      await notifyManage({
        chain: config.chain.id,
        summary: report,
        dry_run: isDryRun(),
      }).catch(() => {});
    }
    return report;
  } catch (e) {
    log("cron_error", e.message);
    return `Management failed: ${e.message}`;
  } finally {
    _manageBusy = false;
  }
}

function startCron() {
  cron.schedule(`*/${Math.max(1, config.schedule.managementIntervalMin)} * * * *`, () => {
    runManagementCycle({ silent: true }).catch((e) => log("cron_error", e.message));
  });
  cron.schedule(`*/${Math.max(1, config.schedule.screeningIntervalMin)} * * * *`, () => {
    runScreeningCycle({ silent: true }).catch((e) => log("cron_error", e.message));
  });
  log("cron", `Started manage=${config.schedule.managementIntervalMin}m screen=${config.schedule.screeningIntervalMin}m`);
}

const isMain = process.argv[1] && process.argv[1].includes("index.js");
if (isMain) {
  console.log("evm-lp-agent daemon");
  console.log(`Chain: ${config.chain.name} | DEX: ${config.dex.name} | DRY_RUN=${isDryRun()}`);
  console.log("Markets:", listSupportedMarkets().map((m) => `${m.chain}/${m.dex}`).join(", "));
  console.log(`Telegram: ${telegramEnabled() ? "enabled" : "disabled (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)"}`);
  if (telegramEnabled()) {
    sendHTML(
      `🤖 <b>evm-lp-agent started</b>\n` +
        `Chain: ${config.chain.name}\n` +
        `DEX: ${config.dex.name}\n` +
        `DRY_RUN: ${isDryRun()}`,
    ).catch(() => {});
  }
  startCron();
  runScreeningCycle({ silent: false }).catch((e) => log("startup_error", e.message));
}
