---
description: Fetch and analyse top EVM pool candidates
---
Fetch top 5 enriched pool candidates on the active chain:

1. Get pool candidates:
```bash
node cli.js candidates --limit 5
```

Analyse each candidate and give a deploy recommendation (yes/no) with reasoning. Consider:
- fee APR % (higher is better)
- GMGN safety signals (reject if honeypot or blacklisted)
- price trend (prefer stable or uptrending)
- volume vs TVL (higher activity is better)
- minimum 24h transactions (reject if < 10)

Rank them and suggest which (if any) to deploy into.
