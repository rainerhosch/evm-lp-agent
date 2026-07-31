---
name: evm-lp
description: >
  Hub skill for the EVM concentrated-liquidity LP agent (Uniswap V3 / PancakeSwap V3).
  Use for /evm-lp, "evm lp agent", "uniswap agent", "pancake agent", "bsc lp", "base lp",
  screening EVM pools, dry-run deploy, or managing Uni/Cake V3 positions. Routes to
  specialized skills and official Uniswap/Pancake docs.
metadata:
  short-description: "EVM Uniswap/Pancake LP agent hub"
---

# EVM LP agent — Grok hub

Repo: sibling of Meridian at `../evm-lp-agent` (or absolute  
`C:\Users\oktan\Work\CryptoProject\evm-lp-agent`).

## Read first

1. `README.md` + `CLAUDE.md` in the evm-lp-agent repo  
2. `.grok/skills/evm-lp/references/official-docs.md` — Uniswap V3/V4 + Pancake official links  
3. `.grok/skills/evm-lp/references/univ3-concepts.md` — ticks, fees, NPM lifecycle  
4. `.grok/skills/evm-lp/references/risk-rules.md`  
5. `.grok/skills/evm-lp/references/safety.md`  
6. `.grok/skills/evm-lp/references/cli-commands.md`  
7. `.grok/skills/evm-lp/references/live-mint-checklist.md` — before any live mint  

## Skill map

| Intent | Skill |
|--------|--------|
| Wallet balance | `/evm-lp-balance` |
| Open positions | `/evm-lp-positions` |
| Top pools | `/evm-lp-candidates` |
| Full screen + deploy | `/evm-lp-screen` |
| Manage / close | `/evm-lp-manage` |
| Screener persona | `/evm-lp-screener` |
| Manager persona | `/evm-lp-manager` |
| Deploy ops (dry/live prep) | `/evm-lp-deploy` |
| Implement live mint | `/evm-lp-live-mint` |
| Uniswap V3/V4 docs | `/uniswap-docs` |
| Pancake V3 / Infinity docs | `/pancakeswap-docs` |

## Markets (`dex: auto`)

| Chain | DEX |
|-------|-----|
| ethereum, base, arbitrum | Uniswap V3 |
| bsc | PancakeSwap V3 |

## Critical rules

1. **v0.1 live mint is gated** — dry-run works; live needs SDK tick math (see `/evm-lp-live-mint`).  
2. **V3 ≠ V4 ≠ Infinity** — do not use V3 NPM against V4/Infinity pools.  
3. Verify contract addresses on official deployment pages.  
4. Micro funds: prefer **Base/BSC** over Ethereum mainnet gas.  
5. Never expose private keys.

## Default vague workflow

1. `node cli.js balance`  
2. `node cli.js positions`  
3. If positions → `/evm-lp-manage`  
4. Else → `/evm-lp-candidates` or `/evm-lp-screen` with `DRY_RUN=true`  

Working directory for all CLI: **evm-lp-agent repo root**.
