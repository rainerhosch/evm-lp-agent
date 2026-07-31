---
name: evm-lp-balance
description: >
  Check EVM wallet native balance for the evm-lp-agent (ETH/BNB). Use for
  /evm-lp-balance, "evm balance", "ETH balance", "BNB wallet", Uniswap wallet funds.
metadata:
  short-description: "EVM native wallet balance"
---

# EVM LP balance

From **evm-lp-agent** root:

```bash
node cli.js balance
# or
node cli.js balance --chain bsc
node cli.js balance --chain base
```

## Report

- Wallet address  
- Chain + DEX  
- Native amount + symbol (ETH / BNB)  
- Whether balance ≥ `deployAmountNative + gasReserve`  
- Suggested `compute_deploy` from config  
- `dry_run` flag  

## Setup

If missing key:

```bash
# .env
EVM_PRIVATE_KEY=0x...
EVM_CHAIN=ethereum
ETH_RPC_URL=...
DRY_RUN=true
```

## Safety

Do not print private keys. Truncate address in chat if user is screen-sharing (optional).
