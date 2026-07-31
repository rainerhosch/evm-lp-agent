---
name: evm-lp-deploy
description: >
  Deploy / mint ops for evm-lp-agent: dry-run deploy, sizing, pool selection, prep for
  live Uniswap V3 or Pancake V3 mint. Use for /evm-lp-deploy, "mint uni position",
  "open pancake lp", "dry run deploy eth".
metadata:
  short-description: "Deploy V3 LP (dry + prep)"
---

# EVM LP deploy

## Dry-run (supported now)

```bash
node cli.js deploy --pool 0x... --amount 0.015 --dry-run
# or full cycle
node cli.js screen --dry-run --silent
```

Creates `state.json` entry `dry-<chain>-…` — **no chain tx**.

## Sizing

```bash
node cli.js config
```

Uses `computeDeployAmount(native)`:

- floor `deployAmountNative`  
- ceil `maxDeployAmount`  
- reserve `gasReserve`  

## Pre-live requirements

Before `DRY_RUN=false`:

1. Read `.grok/skills/evm-lp/references/live-mint-checklist.md`  
2. Follow Uni mint guide:  
   https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position  
3. Confirm NPM address for chain (official-docs.md)  
4. Implement/complete `/evm-lp-live-mint`  

## Fee tier selection

| Pair type | Typical Uni fee |
|-----------|-----------------|
| Stable/stable | 100 (0.01%) |
| Major (ETH/USDC) | 500 (0.05%) |
| Standard | 3000 (0.3%) |
| Exotic / volatile | 10000 (1%) |

Must **match existing pool fee** — wrong fee = wrong pool.

## Do not

- Truncate addresses  
- Mix V4 pool with V3 NPM  
- Deploy all native (keep gasReserve)
