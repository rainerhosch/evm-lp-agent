---
name: evm-lp-candidates
description: >
  Fetch and rank Uniswap V3 / Pancake V3 pool candidates via GeckoTerminal for
  evm-lp-agent. Use for /evm-lp-candidates, "top uniswap pools", "pancake pools",
  "best fee APR pool", "screen without deploy".
metadata:
  short-description: "Top Uni/Cake V3 pools"
---

# EVM LP candidates

```bash
node cli.js candidates --limit 10
node cli.js candidates --chain bsc --limit 10
node cli.js candidates --chain base --limit 5
```

## Evaluate

| Metric | Prefer |
|--------|--------|
| fee_apr_pct (proxy) | Higher, but sanity-check fee tier |
| volume_24h_usd / tvl | Productive books |
| tvl_usd | Above minTvlUsd |
| dex_id | uniswap_v3 / pancakeswap-v3-* |
| price_change_24h | Extreme pumps = OOR risk |

## Output

1. Ranked table: name, pool, tvl, vol, feeAPR, score  
2. Top pick + risks  
3. Rejects with one-line reason  
4. **Do not deploy** unless user asked `/evm-lp-screen` or deploy  

## Protocol note

Fee tier is per-pool (0.01% / 0.05% / 0.3% / 1%). Official concepts:

- https://docs.uniswap.org/concepts/protocol/fees  
- https://docs.uniswap.org/concepts/protocol/concentrated-liquidity  

Gecko APR is a **proxy** (agent may assume wrong fee % if metadata thin) — verify pool fee on explorer before live mint.
