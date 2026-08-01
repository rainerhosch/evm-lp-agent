# evm-lp-agent

Autonomous **concentrated-liquidity** LP agent for EVM DEXes. Driven by LLMs (via Claude CLI or OpenRouter), it screens pools, evaluates charts, deploys positions, and manages risk autonomously while learning from its past trades.

| Chain | DEX | Notes |
|-------|-----|--------|
| **Ethereum** | Uniswap V3 | Default — “retail / Uniswap” venue |
| **Base** | Uniswap V3 | Low-fee ETH L2 |
| **Arbitrum** | Uniswap V3 | High-volume Uni V3 |
| **BNB Smart Chain** | **PancakeSwap V3** | Binance ecosystem |
| **Robinhood** | **Uniswap V3** | Robinhood ecosystem |

---

## 🧠 How It Works

The agent acts as an autonomous crypto trader specifically built for EVM Concentrated Liquidity pools (Uniswap V3 / PancakeSwap V3). It utilizes a "Hands and Brain" architecture:

1. **The Hands (`cli.js`)**: A suite of local CLI tools that perform specific, deterministic actions. It fetches wallet balances, pulls OHLCV data from GeckoTerminal, computes technical analysis (RSI, Bollinger Bands), checks pool memory, and executes simulated (dry-run) or live deployments.
2. **The Brain (LLM)**: An LLM acts as the decision-maker. It is fed specific prompts (`.claude/agents/screener.md` and `manager.md`) that teach it how to use the CLI tools. It evaluates the data returned by the tools, decides whether to deploy or close a position, and learns from its mistakes.
3. **The Memory (`lessons.js` & `pool-memory.js`)**: Every closed position is recorded. If the agent loses money in a pool because of high volatility, it writes a "lesson" to its memory. The LLM reads these lessons before making future decisions to avoid repeating mistakes.
4. **The Ear (`discord-listener`)**: A background process that monitors specific Discord channels for EVM token addresses (like signals from alpha groups). When it finds a valid `0x...` address, it runs pre-checks (deduplication, token blacklist, pool resolution via GeckoTerminal) and queues it for the LLM to screen.

---

## 🚀 Step-by-Step Setup

### Step 1: Environment Setup
Clone the repository and copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` and provide your keys:
- `EVM_PRIVATE_KEY`: Your wallet's private key.
- `OPENROUTER_API_KEY` (or use Claude CLI): API key for the LLM.
- `EVM_CHAIN`: E.g., `ethereum`, `base`, `bsc`.
- `DRY_RUN`: Set to `true` to simulate trades safely without spending gas.

### Step 2: Configuration
Copy the user config file:
```bash
cp user-config.example.json user-config.json
```
Adjust parameters for your risk profile (e.g., `deployAmountNative`, `maxPositions`).

### Step 3: Install Dependencies
Install the required packages for the core agent:
```bash
npm install
```

### Step 4: Optional - Setup Discord Listener
If you want the agent to automatically scan Discord channels for new token signals:
1. Obtain your personal Discord User Token (from your browser's Developer Tools Network tab).
2. Add it to `.env` as `DISCORD_USER_TOKEN`, along with `DISCORD_GUILD_ID` and `DISCORD_CHANNEL_IDS`.
3. Start the listener in a separate terminal:
```bash
cd discord-listener
npm install
npm start
```

---

## 🛠️ Usage & Commands

You can run the agent in **Interactive Mode** (using Claude CLI) or **Automated/Daemon Mode**.

### Core CLI Commands

Explore the market manually using the built-in commands:

```bash
# Check wallet balance on current chain
node cli.js balance

# Find the top EVM pool candidates
node cli.js candidates --limit 5

# Get detailed metrics for a specific pool
node cli.js pool-detail --pool <0x_address>

# Check TA chart indicators (RSI, Bollinger Bands)
node cli.js chart --pool <0x_address> --side entry

# View the agent's memory of past trades in a pool
node cli.js pool-memory --pool <0x_address>

# Review the rules the AI has learned from closed trades
node cli.js lessons
```

### LLM Autonomous Cycles

To let the AI autonomously screen candidates and deploy:
```bash
node cli.js screen --dry-run
```

To let the AI autonomously review open positions and manage risk (Take Profit / Stop Loss):
```bash
node cli.js manage --dry-run
```

### Multi-Chain Operation

Switch chains instantly via CLI flags:
```bash
# Ethereum Uniswap V3 (default)
node cli.js balance --chain ethereum

# BSC PancakeSwap V3
node cli.js candidates --chain bsc

# Base Uniswap V3
node cli.js screen --chain base --dry-run
```

---

## 🛡️ Safety & Live Execution

- **Dry Run by Default**: Always start with `DRY_RUN=true` or use the `--dry-run` flag. The agent will simulate everything perfectly without broadcasting transactions.
- **Never commit keys**: Ensure your `.env` and `user-config.json` are heavily protected.
- **Live Execution**: Live minting requires sufficient native gas tokens (ETH/BNB). 

---

## 🤖 Telegram Bot Integration

If you set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`, the agent can be controlled remotely via Telegram. 

- `/screen --chain base` — Trigger an AI screening cycle.
- `/manage --chain all` — Trigger risk management.
- `/positions` — View open positions.
- `/pause` / `/resume` — Control the automated cron daemon.

---

## 🗺️ Roadmap

1. **Live On-chain Minting**: Expand tick math calculations to natively support exact pool `slot0` ranges.
2. **Multi-chain Concurrency**: Run agents synchronously across Base, Arbitrum, and Ethereum.
3. **Advanced AI Tooling**: Provide the agent with real-time news sentiment and Twitter scrape capabilities for earlier entries.
