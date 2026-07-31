/**
 * Telegram notifications for EVM LP agent (Meridian-style).
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID   (or user-config.json telegramChatId)
 */
import fs from "fs";
import { repoPath } from "./repo-root.js";
import { log } from "./logger.js";

const USER_CONFIG_PATH = repoPath("user-config.json");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const BASE = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

function nonEmpty(value) {
  if (value == null) return null;
  const t = String(value).trim();
  return t || null;
}

function resolveChatId() {
  const fromEnv = nonEmpty(process.env.TELEGRAM_CHAT_ID);
  let fromConfig = null;
  try {
    if (fs.existsSync(USER_CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"));
      fromConfig = nonEmpty(cfg.telegramChatId);
    }
  } catch (e) {
    log("telegram_warn", `chatId load failed: ${e.message}`);
  }
  return fromConfig || fromEnv || null;
}

let chatId = resolveChatId();

export function reloadChatId() {
  chatId = resolveChatId();
  return chatId;
}

export function isEnabled() {
  return !!(TOKEN && chatId);
}

export function getTelegramStatus() {
  return {
    token_set: !!TOKEN,
    chat_id_set: !!chatId,
    enabled: isEnabled(),
  };
}

async function postTelegram(method, body) {
  if (!TOKEN || !chatId) {
    if (!TOKEN) log("telegram_warn", "TELEGRAM_BOT_TOKEN not set — skip notify");
    else if (!chatId) log("telegram_warn", "TELEGRAM_CHAT_ID / telegramChatId not set — skip notify");
    return null;
  }
  try {
    const res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, ...body }),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) {
        log("telegram_error", `${method} 401 — check TELEGRAM_BOT_TOKEN`);
      } else {
        log("telegram_error", `${method} ${res.status}: ${err.slice(0, 200)}`);
      }
      return null;
    }
    return await res.json();
  } catch (e) {
    log("telegram_error", `${method} failed: ${e.message}`);
    return null;
  }
}

export async function sendMessage(text) {
  if (!isEnabled()) return null;
  return postTelegram("sendMessage", {
    text: String(text).slice(0, 4096),
    disable_web_page_preview: true,
  });
}

export async function sendHTML(html) {
  if (!isEnabled()) return null;
  return postTelegram("sendMessage", {
    text: String(html).slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shortAddr(a, n = 8) {
  if (!a) return "?";
  const s = String(a);
  return s.length <= n + 4 ? s : `${s.slice(0, n)}…`;
}

/**
 * Notify after a successful deploy (dry-run or live).
 */
export async function notifyDeploy({
  pair,
  pool,
  amount_native,
  native_symbol = "ETH",
  position_id,
  fee,
  tick_lower,
  tick_upper,
  chain,
  dex,
  dry_run = false,
  tx = null,
  explorer = null,
}) {
  const mode = dry_run ? "🧪 DRY RUN" : "✅ LIVE";
  const feeStr = fee != null ? `${Number(fee) / 10000}% (${fee})` : "?";
  const range =
    tick_lower != null && tick_upper != null
      ? `ticks [${tick_lower}, ${tick_upper}]`
      : "range n/a";
  const txLine = tx
    ? explorer
      ? `Tx: <a href="${esc(explorer)}/tx/${esc(tx)}"><code>${esc(shortAddr(tx, 12))}</code></a>\n`
      : `Tx: <code>${esc(shortAddr(tx, 16))}</code>\n`
    : "";
  const poolLine = pool
    ? explorer
      ? `Pool: <a href="${esc(explorer)}/address/${esc(pool)}"><code>${esc(shortAddr(pool, 10))}</code></a>\n`
      : `Pool: <code>${esc(shortAddr(pool, 12))}</code>\n`
    : "";

  const html =
    `${mode} <b>Deployed</b> ${esc(pair || "?")}\n` +
    `Chain: ${esc(chain || "?")} | DEX: ${esc(dex || "?")}\n` +
    `Amount: <b>${esc(amount_native)}</b> ${esc(native_symbol)}\n` +
    `Fee tier: ${esc(feeStr)}\n` +
    `Range: ${esc(range)}\n` +
    poolLine +
    `Position: <code>${esc(position_id || "?")}</code>\n` +
    txLine;

  const r = await sendHTML(html);
  if (r) log("telegram", `notifyDeploy sent: ${pair}`);
  return r;
}

/**
 * Notify after a successful close.
 */
export async function notifyClose({
  pair,
  position_id,
  reason = "",
  pnl_pct = null,
  chain,
  dry_run = false,
  tx = null,
}) {
  const mode = dry_run ? "🧪 DRY RUN" : "🔒";
  const pnlStr =
    pnl_pct != null && Number.isFinite(Number(pnl_pct))
      ? `PnL: ${Number(pnl_pct) >= 0 ? "+" : ""}${Number(pnl_pct).toFixed(2)}%\n`
      : "";
  const html =
    `${mode} <b>Closed</b> ${esc(pair || "?")}\n` +
    (chain ? `Chain: ${esc(chain)}\n` : "") +
    pnlStr +
    (reason ? `Reason: ${esc(reason)}\n` : "") +
    `Position: <code>${esc(position_id || "?")}</code>` +
    (tx ? `\nTx: <code>${esc(shortAddr(tx, 16))}</code>` : "");

  const r = await sendHTML(html);
  if (r) log("telegram", `notifyClose sent: ${pair}`);
  return r;
}

/**
 * Notify screening cycle outcome (skip / no deploy / error summary).
 */
export async function notifyScreen({
  chain,
  dex,
  status, // deployed | no_deploy | skip | error
  summary = "",
  dry_run = false,
}) {
  const icon =
    status === "deployed"
      ? "✅"
      : status === "skip"
        ? "⏭️"
        : status === "error"
          ? "❌"
          : "⛔";
  const mode = dry_run ? " (dry)" : "";
  const html =
    `${icon} <b>Screen${mode}</b> ${esc(chain)}/${esc(dex)}\n` +
    `${esc(String(summary).slice(0, 3500))}`;
  return sendHTML(html);
}

/**
 * Notify management cycle actions.
 */
export async function notifyManage({ chain, summary, dry_run = false }) {
  if (!summary || summary === "All positions STAY") return null;
  const mode = dry_run ? "🧪 " : "";
  return sendHTML(
    `${mode}📋 <b>Manage</b> ${esc(chain)}\n${esc(String(summary).slice(0, 3500))}`,
  );
}

/** One-shot connectivity check. */
export async function notifyTest() {
  return sendHTML(
    `🤖 <b>evm-lp-agent</b> Telegram OK\n` +
      `chat_id: <code>${esc(chatId)}</code>`,
  );
}
