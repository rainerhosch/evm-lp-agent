---
description: Evaluate technical analysis chart indicators for an EVM pool
---
Fetch OHLCV data from GeckoTerminal and evaluate technical indicators (RSI, Bollinger Bands, MACD) to confirm an entry or exit point:

```bash
node cli.js chart --pool <pool_address> --side <entry|exit>
```

Always check chart indicators before deploying a position to avoid entering when the token is overbought (RSI > 70) or near the upper Bollinger Band. Conversely, when closing a position, check if the token is oversold (RSI < 30).
