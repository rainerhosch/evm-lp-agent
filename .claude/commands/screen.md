---
description: Full screening cycle — find best EVM pool and deploy if wallet has funds
---
Run a full screening cycle. Use the Bash tool for all commands sequentially.

**Step 1 — Wallet balance:**
```bash
node cli.js balance
```
Check if you have sufficient native balance to deploy (e.g. at least 0.02 ETH or BNB).

**Step 2 — Fetch candidates:**
```bash
node cli.js candidates --limit 5
```

**Step 3 — Deep research on top 2 candidates:**
For each of the top 2 candidates, run:
```bash
node cli.js pool-detail --pool <pool_address>
node cli.js study --pool <pool_address>
```

**Step 4 — Analyse and decide:**
Rank candidates using gathered data:
- Hard reject: Honeypot, blacklisted, TVL < $50k
- Check study output: ensure volatility is manageable

Pick the best candidate and deploy:
```bash
node cli.js deploy --pool <pool_address> --amount <amount_native> --dry-run
```
*(Always run `--dry-run` unless explicitly told to live mint).*

Always explain your full reasoning before executing any deploy.
