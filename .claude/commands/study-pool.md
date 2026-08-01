---
description: Deep dive historical OHLCV study for an EVM pool
---
Analyse the historical behaviour of an EVM pool using GeckoTerminal data:

```bash
node cli.js study --pool <pool_address>
```

Summarise the pool's historical volatility, price range, and overall trend over the past 30 days. Recommend what tick width should be used based on the volatility (tighter for low volatility, wider for high volatility).
