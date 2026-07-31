/**
 * ReAct agent loop for EVM LP — OpenRouter free router + reasoning-aware turns.
 *
 * Model default: openrouter/free
 * Docs: https://openrouter.ai/openrouter/free
 * Reasoning: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 */
import { config } from "./config.js";
import { buildSystemPrompt } from "./prompt.js";
import { tools } from "./tools/definitions.js";
import { executeTool } from "./tools/executor.js";
import { getWalletBalances } from "./tools/wallet.js";
import { getMyPositions } from "./tools/univ3.js";
import { getStateSummary } from "./state.js";
import { log } from "./logger.js";
import {
  OPENROUTER_FREE_MODEL,
  createOpenRouterClient,
  openRouterChat,
  assistantMessageForHistory,
  logReasoningPreview,
  resolveModel,
} from "./llm/openrouter.js";

const SCREENER_TOOLS = new Set([
  "get_wallet_balance",
  "get_top_candidates",
  "get_pool_detail",
  "get_my_positions",
  "deploy_position",
  "get_config",
  "compute_deploy_amount",
  "get_native_price",
  "convert_native_usd",
]);

const MANAGER_TOOLS = new Set([
  "get_wallet_balance",
  "get_my_positions",
  "close_position",
  "claim_fees",
  "get_config",
  "get_native_price",
  "convert_native_usd",
]);

function filterTools(role) {
  const allow =
    role === "SCREENER" ? SCREENER_TOOLS : role === "MANAGER" ? MANAGER_TOOLS : null;
  if (!allow) return tools;
  return tools.filter((t) => allow.has(t.function.name));
}

/**
 * Sanitize history entries so any prior assistant turns keep reasoning_details.
 */
function normalizeHistory(history = []) {
  return history.map((m) => {
    if (m?.role === "assistant") {
      return assistantMessageForHistory(m) || m;
    }
    return m;
  });
}

export async function agentLoop(goal, maxSteps, history = [], role = "GENERAL", model = null) {
  if (!config.llm.apiKey) {
    return {
      content: "LLM API key missing. Set OPENROUTER_API_KEY in .env (OpenRouter free router).",
      userMessage: goal,
    };
  }

  let client;
  try {
    client = createOpenRouterClient();
  } catch (e) {
    return { content: e.message, userMessage: goal };
  }

  const [portfolio, positions] = await Promise.all([
    getWalletBalances(),
    getMyPositions({ force: true }),
  ]);
  const stateSummary = getStateSummary();
  const system = buildSystemPrompt(role, { portfolio, positions, stateSummary });
  const useModel = resolveModel(role, model) || OPENROUTER_FREE_MODEL;

  const messages = [
    { role: "system", content: system },
    ...normalizeHistory(history),
    { role: "user", content: goal },
  ];

  const once = new Set();
  const steps = maxSteps || config.llm.maxSteps;
  const toolDefs = filterTools(role);
  let lastModelUsed = useModel;

  log("agent", `OpenRouter model=${useModel} role=${role} reasoning=${config.llm.reasoningEnabled !== false}`);

  for (let step = 0; step < steps; step++) {
    log("agent", `Step ${step + 1}/${steps}`);
    let response;
    try {
      response = await openRouterChat({
        client,
        model: useModel,
        messages,
        tools: toolDefs,
        tool_choice: role === "SCREENER" && step === 0 ? "required" : "auto",
        temperature: config.llm.temperature,
        max_tokens: config.llm.maxTokens,
      });
    } catch (e) {
      // Free router can 429 / 503 — one retry with plain openrouter/free
      log("error", `LLM error: ${e.message}`);
      if (useModel !== OPENROUTER_FREE_MODEL && step < steps - 1) {
        log("agent", `Falling back to ${OPENROUTER_FREE_MODEL}`);
        try {
          response = await openRouterChat({
            client,
            model: OPENROUTER_FREE_MODEL,
            messages,
            tools: toolDefs,
            tool_choice: "auto",
            temperature: config.llm.temperature,
            max_tokens: config.llm.maxTokens,
          });
          lastModelUsed = OPENROUTER_FREE_MODEL;
        } catch (e2) {
          return { content: `LLM error: ${e2.message}`, userMessage: goal, model: lastModelUsed };
        }
      } else {
        return { content: `LLM error: ${e.message}`, userMessage: goal, model: lastModelUsed };
      }
    }

    // Actual model served by the free router (if reported)
    const served = response?.model;
    if (served && served !== lastModelUsed) {
      log("agent", `Routed to provider model: ${served}`);
      lastModelUsed = served;
    }

    const rawMsg = response.choices?.[0]?.message;
    if (!rawMsg) {
      log("agent", "Empty response, retrying...");
      continue;
    }

    // Debug: show thinking when present
    if (config.llm.logReasoning !== false) {
      logReasoningPreview(rawMsg);
    }

    // Always push assistant turn with full reasoning_details for tool continuity
    const histMsg = assistantMessageForHistory(rawMsg);

    if (rawMsg.tool_calls?.length) {
      messages.push(histMsg);
      for (const call of rawMsg.tool_calls) {
        const name = call.function?.name;
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch {
          args = {};
        }
        if (name === "deploy_position" && once.has("deploy_position")) {
          const blocked = { blocked: true, reason: "deploy_position already used this session" };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(blocked),
          });
          continue;
        }
        const result = await executeTool(name, args);
        if (name === "deploy_position") once.add("deploy_position");
        const icon = result?.blocked || result?.error ? "✗" : "✓";
        console.log(`[${name}] ${icon}`);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 12000),
        });
      }
      continue;
    }

    const content = rawMsg.content || "";
    log("agent", content.slice(0, 200));
    return {
      content,
      userMessage: goal,
      model: lastModelUsed,
      reasoning: rawMsg.reasoning || null,
      reasoning_details: rawMsg.reasoning_details || null,
      // For session continuity callers can append this to history:
      assistantMessage: histMsg,
    };
  }

  return { content: "Max steps reached.", userMessage: goal, model: lastModelUsed };
}
