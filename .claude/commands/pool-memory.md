---
description: Retrieve past deployment history for a pool
---
Fetch the pool's deployment memory to avoid making the same mistake twice:

```bash
node cli.js pool-memory --pool <pool_address>
```

Always check pool memory before deploying. If the agent previously lost money in a pool (or it went out of range constantly), avoid it or adjust the strategy based on the historical PnL and notes.
