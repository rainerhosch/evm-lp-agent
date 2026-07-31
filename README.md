# evm-lp-agent

Autonomous **concentrated-liquidity** LP agent for EVM DEXes:

| Chain | DEX | Notes |
|-------|-----|--------|
| **Ethereum** | Uniswap V3 | Default — “retail / Uniswap” venue |
| **Base** | Uniswap V3 | Low-fee ETH L2 |
| **Arbitrum** | Uniswap V3 | High-volume Uni V3 |
| **BNB Smart Chain** | **PancakeSwap V3** | Binance ecosystem |
| **Robinhood** | **Uniswap V3** | Robinhood ecosystem |

Sibling project to Meridian (Solana / Meteora DLMM). Same ideas (screen → deploy → manage → risk), different chain stack.

> **v0.1:** Screening, sizing, dry-run deploy/close, LLM agent loop, and cron daemon are working.  
> **Live on-chain mint/close** is scaffolded (NPM addresses + ABIs) but intentionally gated until tick math + ERC20 approvals are completed.

---

## OpenRouter free models

Default LLM is **`openrouter/free`** (Free Models Router):

- Docs: https://openrouter.ai/openrouter/free  
- Picks free models that support **tools** / other features your request needs  
- Reasoning tokens: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens  
- Agent preserves `reasoning_details` across tool-call turns  

```env
OPENROUTER_API_KEY=sk-or-v1-...
LLM_MODEL=openrouter/free
OPENROUTER_REASONING_EFFORT=medium
```

Optional leaderboard headers: `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE`.

## Quick start

```bash
cd ../evm-lp-agent   # sibling of meridian-dllm-agent
cp .env.example .env
# edit .env: EVM_PRIVATE_KEY, OPENROUTER_API_KEY, EVM_CHAIN, DRY_RUN=true
cp user-config.example.json user-config.json   # or use included user-config.json

npm install
node cli.js markets
node cli.js balance
node cli.js candidates --limit 5
node cli.js screen --dry-run --silent
node cli.js manage --dry-run
```

### Switch chain

```bash
# Ethereum Uniswap V3 (default)
node cli.js balance --chain ethereum

# BSC PancakeSwap V3
node cli.js candidates --chain bsc

# Base Uniswap V3
node cli.js screen --chain base --dry-run
```

Or set in `.env` / `user-config.json`:
```json
{ "chain": "bsc", "dex": "auto" }
```

---

## Architecture

```
cli.js / index.js
    → agentLoop (SCREENER | MANAGER)
    → executeTool → screening | univ3 | wallet
    → GeckoTerminal pools | ethers RPC | state.json
```

| Module | Role |
|--------|------|
| `chains/registry.js` | Chain IDs, NPM addresses, Uniswap vs Pancake |
| `tools/screening.js` | Pool discovery (GeckoTerminal) + ranking |
| `tools/univ3.js` | V3 position deploy/close (dry-run full; live scaffold) |
| `tools/wallet.js` | ethers v6 wallet + native balance |
| `risk.js` | Score + stop/trailing/OOR/max-hold |
| `state.js` | Local position registry |
| `agent.js` | ReAct LLM tool loop |

---

## Config (micro wallet friendly)

Same spirit as Meridian micro-fund settings:

```json
{
  "deployAmountNative": 0.015,
  "gasReserve": 0.006,
  "maxDeployAmount": 0.018,
  "maxPositions": 1,
  "positionSizePct": 0.75
}
```

Native asset = **ETH** on ethereum/base/arbitrum, **BNB** on bsc.

---

## Safety

- `DRY_RUN=true` → no on-chain txs; state updates only  
- Never commit `.env` or `user-config.json` with keys  
- Live mint requires explicit future work (pool `slot0` tick, token sort, approvals)

---

## Relation to Meridian

| | Meridian | evm-lp-agent |
|--|----------|--------------|
| Chain | Solana | EVM |
| Venue | Meteora DLMM | Uniswap V3 / Pancake V3 |
| Range unit | bins | ticks |
| Position id | PDA | NFT tokenId |
| Quote | SOL | ETH / BNB |

---

## Grok skills (`.grok/skills/`)

Open this repo in Grok Build to auto-load skills (same pattern as Meridian):

| Slash | Purpose |
|--------|---------|
| `/evm-lp` | Hub + skill map |
| `/evm-lp-balance` | Native balance |
| `/evm-lp-positions` | Open positions |
| `/evm-lp-candidates` | Top pools |
| `/evm-lp-screen` | Screen + dry deploy |
| `/evm-lp-manage` | Risk exits / close |
| `/evm-lp-screener` | Screener persona |
| `/evm-lp-manager` | Manager persona |
| `/evm-lp-deploy` | Deploy ops |
| `/evm-lp-live-mint` | Implement live NPM mint |
| `/uniswap-docs` | Uniswap V3/V4 official docs |
| `/pancakeswap-docs` | Pancake V3 / Infinity official docs |

Shared references (under `evm-lp/references/`):

- `official-docs.md` — all official URLs  
- `univ3-concepts.md` — ticks, fees, NFT lifecycle  
- `live-mint-checklist.md` — pre-mainnet checklist  
- `cli-commands.md`, `risk-rules.md`, `safety.md`

---

## Roadmap

1. Live `mint` with accurate ticks from pool contract  
2. PnL from amounts + oracle / pool price  
3. Multi-chain concurrent positions  
4. Telegram ops surface (port from Meridian)
