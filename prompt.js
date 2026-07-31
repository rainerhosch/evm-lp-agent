import { config } from "./config.js";

export function buildSystemPrompt(role, { portfolio, positions, stateSummary } = {}) {
  const chain = config.chain;
  const dex = config.dex;

  const base = `You are an autonomous concentrated-liquidity LP agent for EVM DEXes.
Chain: ${chain.name} (${chain.id}, chainId ${chain.chainId})
DEX: ${dex.name} (${dex.id})
Native: ${chain.nativeSymbol}
DRY_RUN: ${config.dryRun || process.env.DRY_RUN === "true"}

Portfolio: ${JSON.stringify(portfolio)}
Positions: ${JSON.stringify(positions)}
State: ${JSON.stringify(stateSummary)}

Rules:
1. Only deploy via deploy_position tool. Never invent pool addresses.
2. Prefer high fee APR + healthy volume/TVL. Avoid thin books.
3. amount_native is ${chain.nativeSymbol} (not USD).
4. Single position bias when maxPositions is low.
5. In DRY_RUN mode, deploys are simulated — still call deploy_position to "succeed".
6. Swap / memecoin buys are out of scope for v0.1.
`;

  if (role === "SCREENER") {
    return `${base}
Role: SCREENER
Pick the best candidate and call deploy_position with full pool_address, pool_name, amount_native.
If none are good, explain NO DEPLOY without calling deploy.
`;
  }
  if (role === "MANAGER") {
    return `${base}
Role: MANAGER
Apply close/claim rules mechanically. Call close_position or claim_fees when needed.
`;
  }
  return `${base}
Role: GENERAL
Follow the user request with available tools.
`;
}
