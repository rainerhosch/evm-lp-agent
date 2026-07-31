# evm-lp-agent CLI

Run from repo root: `C:\Users\oktan\Work\CryptoProject\evm-lp-agent`  
(or relative sibling of meridian: `../evm-lp-agent`)

```bash
node cli.js <cmd> [flags]
```

JSON on stdout. Sequential for write ops. Prefer `--dry-run` / `DRY_RUN=true`.

## Commands

| Command | Purpose |
|---------|---------|
| `help` | Usage |
| `markets` | Supported chain/DEX pairs |
| `balance [--chain ethereum\|bsc\|base\|arbitrum]` | Native balance |
| `positions` | Tracked (+ optional on-chain NFT count) |
| `candidates [--limit N]` | Top pools (GeckoTerminal + filters) |
| `pool-detail --pool <addr>` | One pool |
| `deploy --pool <addr> [--amount n] [--dry-run]` | Open position (dry-run full) |
| `close --position <id> [--reason t]` | Close tracked position |
| `screen [--dry-run] [--silent]` | AI screening cycle |
| `manage [--dry-run] [--silent]` | Deterministic risk exits + optional LLM |
| `config` | Live config + compute_deploy |

## Env (`.env`)

| Var | Purpose |
|-----|---------|
| `EVM_PRIVATE_KEY` | Hex key |
| `EVM_CHAIN` | ethereum / bsc / base / arbitrum |
| `ETH_RPC_URL` / `BSC_RPC_URL` / … | RPC |
| `OPENROUTER_API_KEY` | LLM |
| `DRY_RUN` | `true` = no txs |
| `GRAPH_API_KEY` | Optional The Graph |

## Chain → DEX (`dex: auto`)

| Chain | DEX |
|-------|-----|
| ethereum, base, arbitrum | uniswap_v3 |
| bsc | pancakeswap_v3 |
