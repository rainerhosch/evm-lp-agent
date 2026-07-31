# evm-lp-agent — engineering notes

Sibling of Meridian DLMM agent. EVM concentrated liquidity (Uniswap V3 family + Pancake V3).

## Entry points

- `node index.js` — daemon (cron screen + manage)
- `node cli.js <cmd>` — one-shot

## Invariants

1. `DRY_RUN` / `dryRun` skip all txs; dry positions get ids `dry-<chain>-…`
2. Live mint/close are **gated** until full tick math is implemented
3. `process.exit(0)` after CLI commands (timers must not hang)
4. Chain selection via `EVM_CHAIN` or `--chain` before config-heavy imports (cli sets env first)
5. BSC always maps to Pancake V3; eth/base/arb map to Uniswap V3 when `dex: auto`

## Adding a chain

1. `chains/registry.js` — CHAINS + NPM/factory addresses  
2. Default RPC in `config.js`  
3. Gecko network slug for screening  

## Tools

See `tools/definitions.js` + `tools/executor.js`.
