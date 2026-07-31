---
name: evm-lp-positions
description: >
  List open Uniswap V3 / Pancake V3 positions tracked by evm-lp-agent. Use for
  /evm-lp-positions, "my uni positions", "pancake lp positions", "NFT positions".
metadata:
  short-description: "Open V3 LP positions"
---

# EVM LP positions

```bash
node cli.js positions
```

## Show per position

| Field | Meaning |
|-------|---------|
| position / token_id | Agent id (dry-*) or NFT id |
| pair / pool | Pool |
| chain / dex | Venue |
| tick_lower / tick_upper | Concentrated range |
| amount_native | Sized capital |
| in_range | Fee-earning? |
| pnl_pct | When pricing wired |
| dry_run | Simulated vs live |

## Docs context

Positions are ERC-721s in NonfungiblePositionManager:

- Uni: https://docs.uniswap.org/contracts/v3/reference/periphery/NonfungiblePositionManager  
- Cake: https://docs.pancakeswap.finance/trading-tools/building-trading-agents-on-pancakeswap-v3  

## Next

Need actions → `/evm-lp-manage`.  
Need live close implementation → `/evm-lp-live-mint` (close path).
