/**
 * Discord signal pre-check pipeline for EVM LP Agent
 * Stages: dedup → blacklist → pool resolution via GeckoTerminal
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPoolDetail } from "../tools/screening.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// In-memory dedup: address → timestamp
const recentSeen = new Map();
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Stage 1: Dedup — reject if seen in last 10 minutes
export function dedupCheck(address) {
  const now = Date.now();
  // Clean old entries
  for (const [k, ts] of recentSeen.entries()) {
    if (now - ts > DEDUP_WINDOW_MS) recentSeen.delete(k);
  }
  if (recentSeen.has(address)) {
    return { pass: false, reason: "dedup: seen in last 10 minutes" };
  }
  recentSeen.set(address, now);
  return { pass: true };
}

// Stage 2: Token blacklist — reject if address is blacklisted
export function blacklistCheck(address) {
  const file = path.join(ROOT, "token-blacklist.json");
  if (!fs.existsSync(file)) return { pass: true };
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (data[address]) {
      return { pass: false, reason: `blacklisted: ${data[address].reason || "no reason"}` };
    }
  } catch { /* parse error, pass */ }
  return { pass: true };
}

// Stage 3: Pool resolution
// Use GeckoTerminal to see if this address is a valid pool
export async function resolvePool(address) {
  try {
    const detail = await getPoolDetail({ pool_address: address });
    if (!detail || detail.error) {
      return { pass: false, reason: detail?.error || "GeckoTerminal returned no pool" };
    }
    
    // EVM agent requires ETH or BNB base pairs
    return { 
      pass: true, 
      pool_address: detail.pool_address, 
      base_mint: detail.token0?.address, 
      symbol: detail.name || "?", 
      source: "geckoterminal",
      token_age_minutes: detail.pool_created_at ? Math.round((Date.now() - new Date(detail.pool_created_at).getTime()) / 60000) : null 
    };
  } catch (e) {
    return { pass: false, reason: `pool resolution failed: ${e.message}` };
  }
}

// Run the full pipeline
export async function runPreChecks(address) {
  console.log(`\n[pre-check] ${address}`);

  const dedup = dedupCheck(address);
  if (!dedup.pass) { console.log(`  REJECT [dedup] ${dedup.reason}`); return { pass: false, ...dedup }; }
  console.log(`  OK [dedup]`);

  const bl = blacklistCheck(address);
  if (!bl.pass) { console.log(`  REJECT [blacklist] ${bl.reason}`); return { pass: false, ...bl }; }
  console.log(`  OK [blacklist]`);

  const pool = await resolvePool(address);
  if (!pool.pass) { console.log(`  REJECT [pool] ${pool.reason}`); return { pass: false, ...pool }; }
  console.log(`  OK [pool] → ${pool.pool_address} (${pool.symbol}, via ${pool.source})`);

  console.log(`  PASS → queuing signal (token age: ${pool.token_age_minutes ?? "unknown"} min)`);
  return {
    pass: true,
    pool_address: pool.pool_address,
    base_mint: pool.base_mint,
    symbol: pool.symbol,
    rug_score: null, // Not supported for EVM natively yet
    total_fees_sol: null,
    token_age_minutes: pool.token_age_minutes,
  };
}
