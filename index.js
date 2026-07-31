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
  startPolling,
  stopPolling,
} from "./telegram.js";
import { handleTelegramCommand } from "./telegram-commands.js";
import {
  isCronPaused,
  getCronStatus,
  registerCronTasks,
  pauseCron,
  resumeCron,
  pauseForRateLimit,
  isRateLimitError,
  clearPauseFlag,
} from "./cron-control.js";

let _screenBusy = false;
let _manageBusy = false;
let _cronStarted = false;

function classifyScreenReport(content) {
  const t = String(content || "");
  if (/skip:/i.test(t)) return "skip";
  if (/rate limit|429|free-models-per-day/i.test(t)) return "error";
  if (/fail|error/i.test(t) && !/deploy/i.test(t)) return "error";
  if (/no deploy|⛔/i.test(t)) return "no_deploy";
  if (/deployed|🚀|✅/i.test(t)) return "deployed";
  return "no_deploy";
}

async function handleRateLimitPause(detail) {
  const { shouldNotify, reason, already } = pauseForRateLimit(detail);
  if (shouldNotify && telegramEnabled()) {
    await sendHTML(
      `⛔ <b>Cron PAUSED</b> — LLM rate limit\n` +
        `${escapeHtml(reason)}\n\n` +
        `Automated screen/manage stopped to avoid further 429 spam.\n` +
        `Manual Telegram commands still work.\n\n` +
        `When ready: <code>/resume</code> or <code>/restart</code>`,
    ).catch(() => {});
  } else if (already) {
    log("cron", `Still paused (rate limit) — skip cycle`);
  }
  return reason;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function runScreeningCycle({ silent = false } = {}) {
  if (isCronPaused() && silent) {
    // Cron-triggered while paused — no-op (belt and suspenders if task not stopped)
    return `Skip: cron paused (${getCronStatus().reason || "paused"})`;
  }
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
      if (telegramEnabled() && !silent) {
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
      if (telegramEnabled() && !silent) {
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

    const result = await agentLoop(goal, config.llm.maxSteps, [], "SCREENER");
    const content = result?.content ?? result;

    if (result?.rate_limited || isRateLimitError(content)) {
      const reason = await handleRateLimitPause(result?.error || content);
      return `Cron paused: ${reason}`;
    }

    if (!silent) console.log(content);

    // Deploy success already notifies via executor.notifyDeploy.
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
    if (isRateLimitError(e)) {
      const reason = await handleRateLimitPause(e.message);
      return `Cron paused: ${reason}`;
    }
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
  if (isCronPaused() && silent) {
    return `Skip: cron paused (${getCronStatus().reason || "paused"})`;
  }
  if (_manageBusy) return "busy";
  _manageBusy = true;
  try {
    const snap = await getMyPositions({ force: true });
    if (!snap.positions?.length) {
      // Don't auto-trigger screen while paused or while burning LLM quota
      if (!isCronPaused()) {
        log("cron", "No positions — optional screen");
        runScreeningCycle({ silent: true }).catch(() => {});
      }
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

export function startCronJobs() {
  // Destroy previous scheduled tasks cleanly
  const prev = getCronStatus();
  if (prev.tasks > 0) {
    pauseCron("restarting cron tasks");
  }

  const mgmt = cron.schedule(
    `*/${Math.max(1, config.schedule.managementIntervalMin)} * * * *`,
    () => {
      if (isCronPaused()) return;
      runManagementCycle({ silent: true }).catch((e) => log("cron_error", e.message));
    },
    { scheduled: true },
  );

  const screen = cron.schedule(
    `*/${Math.max(1, config.schedule.screeningIntervalMin)} * * * *`,
    () => {
      if (isCronPaused()) return;
      runScreeningCycle({ silent: true }).catch((e) => log("cron_error", e.message));
    },
    { scheduled: true },
  );

  registerCronTasks([mgmt, screen]);
  clearPauseFlag();
  _cronStarted = true;
  log(
    "cron",
    `Started manage=${config.schedule.managementIntervalMin}m screen=${config.schedule.screeningIntervalMin}m`,
  );
  return { management: mgmt, screening: screen };
}

/** Public API for Telegram */
export function pauseAutomatedCycles(reason = "telegram /pause") {
  return pauseCron(reason);
}

export function resumeAutomatedCycles(reason = "telegram /resume") {
  const st = getCronStatus();
  if (!_cronStarted || st.tasks === 0) {
    startCronJobs();
    return { restarted: true, ...getCronStatus() };
  }
  const r = resumeCron(reason);
  return { restarted: false, ...r, ...getCronStatus() };
}

export function getAutomationStatus() {
  return {
    ...getCronStatus(),
    cron_started: _cronStarted,
    screen_busy: _screenBusy,
    manage_busy: _manageBusy,
  };
}

const isMain = process.argv[1] && process.argv[1].includes("index.js");
if (isMain) {
  console.log("evm-lp-agent daemon");
  console.log(`Chain: ${config.chain.name} | DEX: ${config.dex.name} | DRY_RUN=${isDryRun()}`);
  console.log("Markets:", listSupportedMarkets().map((m) => `${m.chain}/${m.dex}`).join(", "));
  console.log(`Telegram: ${telegramEnabled() ? "enabled" : "disabled (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)"}`);

  startPolling(handleTelegramCommand);

  if (telegramEnabled()) {
    sendHTML(
      `🤖 <b>evm-lp-agent started</b>\n` +
        `Chain: ${config.chain.name}\n` +
        `DEX: ${config.dex.name}\n` +
        `DRY_RUN: ${isDryRun()}\n` +
        `Commands: /help · /pause · /resume`,
    ).catch(() => {});
  }

  startCronJobs();
  runScreeningCycle({ silent: false }).catch((e) => log("startup_error", e.message));

  process.on("SIGINT", () => {
    stopPolling();
    pauseCron("shutdown");
    process.exit(0);
  });
}
