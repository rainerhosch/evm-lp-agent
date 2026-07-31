#!/usr/bin/env node
/**
 * evm-lp — CLI for EVM concentrated-liquidity agent
 */
import { parseArgs } from "util";
import dotenv from "dotenv";
import { repoPath } from "./repo-root.js";

dotenv.config({ path: repoPath(".env") });

if (process.argv.includes("--dry-run")) process.env.DRY_RUN = "true";

const argv = process.argv.slice(2);
const subcommand = argv.find((a) => !a.startsWith("-")) || "help";

const { values: flags } = parseArgs({
  args: argv,
  options: {
    chain: { type: "string" },
    limit: { type: "string" },
    pool: { type: "string" },
    amount: { type: "string" },
    position: { type: "string" },
    reason: { type: "string" },
    "dry-run": { type: "boolean" },
    silent: { type: "boolean" },
  },
  allowPositionals: true,
  strict: false,
});

if (flags.chain) process.env.EVM_CHAIN = flags.chain;

function out(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function die(msg) {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  process.exit(1);
}

switch (subcommand) {
  case "help":
  case "--help":
  case "-h": {
    console.log(`evm-lp-agent CLI

Usage: node cli.js <cmd> [flags]

Commands:
  markets                 List supported chain/DEX pairs
  balance [--chain ethereum|bsc|base|arbitrum]
  positions
  candidates [--limit 10]
  pool-detail --pool <addr>
  deploy --pool <addr> [--amount 0.015] [--dry-run]
  close --position <id> [--reason text]
  screen [--dry-run] [--silent]
  manage [--dry-run] [--silent]
  config

Env: EVM_PRIVATE_KEY, ETH_RPC_URL / BSC_RPC_URL, OPENROUTER_API_KEY, DRY_RUN, EVM_CHAIN
`);
    break;
  }

  case "markets": {
    const { listSupportedMarkets } = await import("./chains/registry.js");
    out(listSupportedMarkets());
    break;
  }

  case "balance": {
    const { getWalletBalances } = await import("./tools/wallet.js");
    out(await getWalletBalances());
    break;
  }

  case "positions": {
    const { getMyPositions } = await import("./tools/univ3.js");
    out(await getMyPositions({ force: true }));
    break;
  }

  case "candidates": {
    const { getTopCandidates } = await import("./tools/screening.js");
    out(await getTopCandidates({ limit: Number(flags.limit || 10) }));
    break;
  }

  case "pool-detail": {
    if (!flags.pool) die("Usage: pool-detail --pool <address>");
    const { getPoolDetail } = await import("./tools/screening.js");
    out(await getPoolDetail({ pool_address: flags.pool }));
    break;
  }

  case "deploy": {
    if (!flags.pool) die("Usage: deploy --pool <address> [--amount n]");
    const { deployPosition } = await import("./tools/univ3.js");
    out(
      await deployPosition({
        pool_address: flags.pool,
        amount_native: flags.amount ? Number(flags.amount) : undefined,
      }),
    );
    break;
  }

  case "close": {
    if (!flags.position) die("Usage: close --position <id>");
    const { closePosition } = await import("./tools/univ3.js");
    out(await closePosition({ position_id: flags.position, reason: flags.reason || "cli" }));
    break;
  }

  case "screen": {
    const { runScreeningCycle } = await import("./index.js");
    const report = await runScreeningCycle({ silent: !!flags.silent });
    out({ done: true, report });
    break;
  }

  case "manage": {
    const { runManagementCycle } = await import("./index.js");
    const report = await runManagementCycle({ silent: !!flags.silent });
    out({ done: true, report });
    break;
  }

  case "config": {
    const { config, computeDeployAmount, isDryRun } = await import("./config.js");
    const { getWalletBalances } = await import("./tools/wallet.js");
    const bal = await getWalletBalances().catch(() => ({ native: 0 }));
    out({
      dry_run: isDryRun(),
      chain: config.chain,
      dex: { id: config.dex.id, name: config.dex.name, positionManager: config.dex.positionManagerAddress },
      rpc: config.rpcUrl,
      management: config.management,
      risk: config.risk,
      screening: config.screening,
      llm_models: {
        screening: config.llm.screeningModel,
        management: config.llm.managementModel,
      },
      compute_deploy: computeDeployAmount(bal.native || 0),
    });
    break;
  }

  default:
    die(`Unknown command: ${subcommand}. Try: node cli.js help`);
}

process.exit(0);
