---
name: evm-lp-manage
description: >
  Manage open Uniswap/Pancake V3 positions: stop loss, trailing TP, OOR, max hold,
  close/claim. Use for /evm-lp-manage, "close uni position", "manage pancake lp".
metadata:
  short-description: "Manage V3 LP positions"
---

# EVM LP manage

```bash
node cli.js manage --dry-run
node cli.js positions
```

## Rules (see risk-rules.md)

1. Stop loss  
2. Trailing TP (winners run; hard TP off while trailing)  
3. OOR wait  
4. Max hold capital rotation  
5. Claim fees when threshold met (live pricing)  

## Manual close

```bash
node cli.js close --position <id> --reason "trailing TP"
```

## Official close sequence (live)

From Uniswap docs:

1. `decreaseLiquidity`  
2. `collect`  
3. `burn`  

Guide: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/decrease-liquidity  

Pancake V3: same NPM pattern —  
https://docs.pancakeswap.finance/trading-tools/building-trading-agents-on-pancakeswap-v3  

## Prefer engine

`node cli.js manage` runs deterministic `checkExitRules` first; LLM only when needed.
