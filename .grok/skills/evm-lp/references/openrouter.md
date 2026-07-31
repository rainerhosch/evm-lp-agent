# OpenRouter free router + reasoning

## Free Models Router

- Page: https://openrouter.ai/openrouter/free  
- Model slug: **`openrouter/free`**  
- Selects free models that support required features (tools, images, etc.)

```js
{
  model: "openrouter/free",
  messages: [...],
  tools: [...],
  reasoning: { enabled: true, effort: "medium" }
}
```

## Reasoning tokens

- Docs: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens  
- Request: `reasoning: { enabled, effort, max_tokens, exclude }`  
- Response: `message.reasoning` and/or `message.reasoning_details[]`  
- **On tool loops:** pass `reasoning_details` back unmodified on the assistant message

## Agent wiring

| File | Role |
|------|------|
| `llm/openrouter.js` | Client, headers, reasoning, history helper |
| `agent.js` | ReAct loop preserves reasoning across tools |
| `config.js` / `user-config.json` | `openrouter/free` + reasoningEffort |

## Env

```env
OPENROUTER_API_KEY=
LLM_MODEL=openrouter/free
OPENROUTER_REASONING_EFFORT=medium
OPENROUTER_HTTP_REFERER=https://github.com/evm-lp-agent
OPENROUTER_APP_TITLE=evm-lp-agent
```
