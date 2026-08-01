---
description: Manage AI agent lessons and thresholds
---
View the lessons the AI has learned from closed positions:

```bash
node cli.js lessons
```

Add a manual lesson to explicitly teach the agent a new rule:

```bash
node cli.js lessons add "AVOID: pools with fee_tvl_ratio < 0.1 during high volatility"
```
