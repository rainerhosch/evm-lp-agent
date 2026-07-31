---
name: evm-lp-screen
description: >
  Full EVM screening cycle: balance, candidates, LLM pick, optional dry-run deploy
  on Uniswap V3 or Pancake V3. Use for /evm-lp-screen, "screen uniswap", "deploy pancake
  dry run", "find eth lp pool".
metadata:
  short-description: "Screen + dry deploy V3 LP"
---

# EVM LP screen

Working dir: **evm-lp-agent** root.  
Docs: `.grok/skills/evm-lp/references/official-docs.md`

## Fast path

```bash
# Ensure DRY_RUN
# Windows: $env:DRY_RUN='true'
node cli.js screen --dry-run --silent
```

## Manual path

```bash
node cli.js config
node cli.js balance
node cli.js candidates --limit 8
# optional deep:
node cli.js pool-detail --pool <addr>
```

Then either:

```bash
node cli.js deploy --pool <addr> --amount <native> --dry-run
```

or let the LLM cycle (`screen`) call `deploy_position`.

## Deploy constraints (agent)

- `amount_native` = ETH or BNB (not USD)  
- `maxPositions` often 1  
- Live mint **blocked** until `/evm-lp-live-mint` complete  
- Full pool address required (no truncation)

## Report

- Chain/DEX  
- Deploy size  
- Winner pool + why  
- Explicit `DRY RUN — no on-chain tx` or live result  

## Safety

Prefer dry-run. Ethereum gas may exceed micro principal — suggest Base/BSC for tiny wallets.
