---
description: Run the management cycle for open EVM positions
---
Review and manage open positions:

1. View positions:
```bash
node cli.js positions
```

2. Review status:
- If PnL > 10% and out-of-range, close to lock profits.
- If deeply unprofitable (< -25%) and out-of-range, stop loss.
- If in-range and earning fees, hold.

To close a position:
```bash
node cli.js close --position <id> --reason "<your reason>"
```
