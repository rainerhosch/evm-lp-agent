/**
 * Cron pause/resume for rate limits and Telegram control.
 */
import { log } from "./logger.js";

/** @type {import('node-cron').ScheduledTask[]} */
let _tasks = [];
let _paused = false;
let _pauseReason = null;
let _pausedAt = null;
let _rateLimitNotified = false;

export function isCronPaused() {
  return _paused;
}

export function getCronStatus() {
  return {
    paused: _paused,
    reason: _pauseReason,
    paused_at: _pausedAt,
    tasks: _tasks.length,
  };
}

export function registerCronTasks(tasks) {
  _tasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
}

export function pauseCron(reason = "manual") {
  if (_paused) {
    _pauseReason = reason;
    return { already: true, reason: _pauseReason, paused_at: _pausedAt };
  }
  for (const t of _tasks) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  _paused = true;
  _pauseReason = reason;
  _pausedAt = new Date().toISOString();
  log("cron", `PAUSED — ${reason}`);
  return { already: false, reason, paused_at: _pausedAt };
}

export function resumeCron(reason = "manual") {
  if (!_paused) {
    for (const t of _tasks) {
      try {
        t.start();
      } catch {
        /* ignore */
      }
    }
    return { already: true, previous_reason: null };
  }
  for (const t of _tasks) {
    try {
      t.start();
    } catch {
      /* ignore */
    }
  }
  const prev = _pauseReason;
  _paused = false;
  _pauseReason = null;
  _pausedAt = null;
  _rateLimitNotified = false;
  log("cron", `RESUMED — was: ${prev} (${reason})`);
  return { already: false, previous_reason: prev };
}

/** Force clear pause flag without starting tasks (used when re-registering tasks). */
export function clearPauseFlag() {
  _paused = false;
  _pauseReason = null;
  _pausedAt = null;
  _rateLimitNotified = false;
}

/**
 * Detect OpenRouter / HTTP rate limits (429 free-models-per-day, etc.)
 */
export function isRateLimitError(errOrMsg) {
  const msg = String(
    typeof errOrMsg === "string"
      ? errOrMsg
      : errOrMsg?.message || errOrMsg?.error || errOrMsg?.content || "",
  ).toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("rate-limit") ||
    msg.includes("free-models-per-day") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted")
  );
}

/**
 * Pause cron due to LLM rate limit. Returns true if this is the first notify window.
 */
export function pauseForRateLimit(detail = "") {
  const reason = detail
    ? `OpenRouter rate limit: ${String(detail).slice(0, 200)}`
    : "OpenRouter rate limit (free-models-per-day / 429)";
  const result = pauseCron(reason);
  const shouldNotify = !_rateLimitNotified;
  _rateLimitNotified = true;
  return { ...result, shouldNotify, reason };
}
