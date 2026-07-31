---
name: uniswap-docs
description: >
  Uniswap V3 and V4 official documentation navigator for the EVM LP agent. Use for
  /uniswap-docs, "uniswap v3 docs", "uniswap v4 hooks", "NPM mint guide", "concentrated
  liquidity docs", "uni fee tiers".
metadata:
  short-description: "Uniswap V3/V4 official docs"
---

# Uniswap official docs skill

When the user needs protocol truth for Uniswap, **open or cite** these docs (prefer over third-party blogs).

## V3 — primary agent target

| Need | Doc |
|------|-----|
| What is concentrated liquidity? | https://docs.uniswap.org/concepts/protocol/concentrated-liquidity |
| Fees / tiers | https://docs.uniswap.org/concepts/protocol/fees |
| Core contracts overview | https://docs.uniswap.org/contracts/v3/overview |
| Deployed addresses | https://docs.uniswap.org/contracts/v3/reference/deployments/ |
| NonfungiblePositionManager | https://docs.uniswap.org/contracts/v3/reference/periphery/NonfungiblePositionManager |
| Mint liquidity guide | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position |
| Collect fees | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/collect-fees |
| Remove liquidity | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/decrease-liquidity |
| Swaps | https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps |
| v3-sdk | https://docs.uniswap.org/sdk/v3/overview |
| Subgraph | https://docs.uniswap.org/api/subgraph/overview |

## V4 — future / do not mix with V3 mint

| Need | Doc |
|------|-----|
| V4 overview | https://docs.uniswap.org/contracts/v4/overview |
| Hooks concept | https://docs.uniswap.org/concepts/protocol/hooks |
| PoolManager | https://docs.uniswap.org/contracts/v4/concepts/PoolManager |
| V4 SDK | https://docs.uniswap.org/sdk/v4/overview |
| V4 deployments | https://docs.uniswap.org/contracts/v4/deployments |

## Agent mapping

| Agent module | Uni concept |
|--------------|-------------|
| `tools/univ3.js` | NPM mint / decrease / collect / burn |
| `tickRangeWidth` | Position width in ticks |
| `fee` | Pool fee tier |
| ethereum / base / arbitrum | Uni V3 deployments |

## How to answer doc questions

1. Quote the official page topic  
2. Link the URL  
3. Translate to agent code path (`tools/univ3.js`, `chains/registry.js`)  
4. Warn if feature is V4-only (hooks) while agent is V3  

Full index also in: `.grok/skills/evm-lp/references/official-docs.md`
