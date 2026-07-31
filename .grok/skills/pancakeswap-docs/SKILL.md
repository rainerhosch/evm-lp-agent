---
name: pancakeswap-docs
description: >
  PancakeSwap V3 and Infinity official documentation navigator for the EVM LP agent
  on BNB Chain. Use for /pancakeswap-docs, "pancake v3 docs", "pancake npm address",
  "infinity docs", "bsc lp docs", "cake v3 sdk".
metadata:
  short-description: "PancakeSwap V3/Infinity official docs"
---

# PancakeSwap official docs skill

## V3 — agent target on BSC (`EVM_CHAIN=bsc`)

| Need | Doc |
|------|-----|
| Developer home | https://developer.pancakeswap.finance/ |
| V3 contract FAQ | https://developer.pancakeswap.finance/contracts/v3/faq |
| V3 addresses (NPM, factory) | https://developer.pancakeswap.finance/contracts/v3/addresses |
| V3 SDK | https://developer.pancakeswap.finance/sdks/v3-sdk |
| SDKs overview / smart router | https://developer.pancakeswap.finance/sdks/overview |
| Building trading agents on V3 | https://docs.pancakeswap.finance/trading-tools/building-trading-agents-on-pancakeswap-v3 |
| Subgraph | https://developer.pancakeswap.finance/apis/subgraph |
| Protocol developers | https://docs.pancakeswap.finance/protocol/developers |

## Canonical BSC NPM (verify on docs)

NonfungiblePositionManager BSC:  
`0x46A15B0b27311cedF172AB29E4f4766fbE7F4364`  

Also stored in `chains/registry.js` — re-check official page before live mint.

## Infinity (Pancake next-gen ≈ Uni V4)

| Need | Doc |
|------|-----|
| Product overview | https://docs.pancakeswap.finance/trade/pancakeswap-infinity |
| Contracts overview | https://developer.pancakeswap.finance/contracts/infinity/overview |
| Addresses | https://developer.pancakeswap.finance/contracts/infinity/resources/addresses |

**Agent note:** Infinity uses Vault / PoolManagers / Hooks — **not** the V3 NPM API. Separate future module.

## Agent mapping

| Agent | Pancake |
|-------|---------|
| `EVM_CHAIN=bsc` | Auto `pancakeswap_v3` |
| `tools/univ3.js` | Shared V3-style NPM interface |
| Screening | Gecko network `bsc` |

## How to answer

1. Prefer developer.pancakeswap.finance for contracts  
2. Use the trading-agents guide for mint/collect lifecycle narrative  
3. Distinguish V3 LP vs MasterChef farm staking  
4. Link Infinity only when user asks about hooks / modular AMM  

Full index: `.grok/skills/evm-lp/references/official-docs.md`
