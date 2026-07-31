/**
 * OpenRouter client helpers.
 *
 * Free Models Router: https://openrouter.ai/openrouter/free
 * Reasoning tokens:   https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 *
 * openrouter/free picks free models that support required features (tools, etc.).
 */
import OpenAI from "openai";
import { config } from "../config.js";
import { log } from "../logger.js";

/** Official free router slug (OpenRouter docs). */
export const OPENROUTER_FREE_MODEL = "openrouter/free";

/**
 * Optional app attribution headers — show on OpenRouter leaderboards.
 * https://openrouter.ai/docs
 */
export function openRouterHeaders() {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER ||
    config.llm?.httpReferer ||
    "https://github.com/evm-lp-agent";
  const title =
    process.env.OPENROUTER_APP_TITLE ||
    config.llm?.appTitle ||
    "evm-lp-agent";
  return {
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

export function createOpenRouterClient() {
  const apiKey = config.llm.apiKey;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY (or LLM_API_KEY) is required");
  }
  return new OpenAI({
    baseURL: config.llm.baseURL || "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: openRouterHeaders(),
  });
}

/**
 * Build reasoning config for OpenRouter.
 * @returns {object|undefined}
 */
export function buildReasoningParam() {
  if (config.llm.reasoningEnabled === false) return undefined;
  const r = config.llm.reasoning;
  if (r === false) return undefined;
  if (r && typeof r === "object" && r.enabled === false) return undefined;

  // Default: enable reasoning (OpenRouter free page + reasoning-tokens guide).
  const out = { enabled: true };
  if (r && typeof r === "object") {
    if (r.effort) out.effort = r.effort;
    if (r.max_tokens != null) out.max_tokens = Number(r.max_tokens);
    if (r.exclude != null) out.exclude = !!r.exclude;
    if (r.context) out.context = r.context;
  }
  if (!out.effort && config.llm.reasoningEffort) {
    out.effort = config.llm.reasoningEffort;
  }
  // "none" effort = disable
  if (out.effort === "none") return { effort: "none" };
  return out;
}

/**
 * Chat completion via OpenRouter with free-router defaults + reasoning.
 */
export async function openRouterChat({
  client,
  model,
  messages,
  tools,
  tool_choice = "auto",
  temperature,
  max_tokens,
}) {
  const payload = {
    model: model || config.llm.defaultModel || OPENROUTER_FREE_MODEL,
    messages,
    temperature: temperature ?? config.llm.temperature,
    max_tokens: max_tokens ?? config.llm.maxTokens,
  };

  if (tools?.length) {
    payload.tools = tools;
    payload.tool_choice = tool_choice;
  }

  const reasoning = buildReasoningParam();
  if (reasoning) {
    // OpenRouter extension — see reasoning-tokens docs
    payload.reasoning = reasoning;
  }

  // Optional provider preferences from user-config (do not force free router filters here;
  // openrouter/free already selects free models that support tools/etc.)
  if (config.llm.provider && typeof config.llm.provider === "object") {
    payload.provider = config.llm.provider;
  }

  try {
    return await client.chat.completions.create(payload);
  } catch (err) {
    // Some SDK versions strip non-OpenAI fields; retry with only standard fields
    const msg = err?.message || String(err);
    if (reasoning && /unrecognized|unknown|extra|unexpected/i.test(msg)) {
      log("llm_warn", `Retry without reasoning body field: ${msg}`);
      const { reasoning: _r, provider: _p, ...rest } = payload;
      return await client.chat.completions.create(rest);
    }
    throw err;
  }
}

/**
 * Normalize assistant message for multi-turn / tool loops.
 * MUST preserve reasoning_details (and reasoning string) so the model can continue.
 * https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#preserving-reasoning
 */
export function assistantMessageForHistory(msg) {
  if (!msg) return null;
  const out = {
    role: "assistant",
    content: msg.content ?? null,
  };
  if (msg.tool_calls?.length) {
    out.tool_calls = msg.tool_calls;
  }
  // Preserve complete reasoning blocks unmodified
  if (msg.reasoning_details != null) {
    out.reasoning_details = msg.reasoning_details;
  }
  if (msg.reasoning != null) {
    out.reasoning = msg.reasoning;
  }
  // Alias some providers use
  if (msg.reasoning_content != null && out.reasoning == null) {
    out.reasoning = msg.reasoning_content;
  }
  return out;
}

/**
 * Log a short reasoning preview (debug / ops).
 */
export function logReasoningPreview(msg, maxLen = 240) {
  const text =
    msg?.reasoning ||
    (Array.isArray(msg?.reasoning_details)
      ? msg.reasoning_details
          .map((d) => d.text || d.summary || "")
          .filter(Boolean)
          .join(" ")
      : "");
  if (!text) return;
  const preview = String(text).replace(/\s+/g, " ").slice(0, maxLen);
  log("reasoning", preview + (String(text).length > maxLen ? "…" : ""));
}

/**
 * Resolve model for a role — always prefer openrouter/free unless user overrides.
 */
export function resolveModel(role, override = null) {
  if (override) return override;
  if (role === "SCREENER") return config.llm.screeningModel;
  if (role === "MANAGER") return config.llm.managementModel;
  return config.llm.generalModel;
}
