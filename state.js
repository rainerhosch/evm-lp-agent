/**
 * Local position state (JSON) — mirrors Meridian state pattern for EVM NFT positions.
 */
import fs from "fs";
import { repoPath } from "./repo-root.js";
import { log } from "./logger.js";

const STATE_FILE = repoPath("state.json");

function load() {
  if (!fs.existsSync(STATE_FILE)) return { positions: {}, recentEvents: [] };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { positions: {}, recentEvents: [] };
  }
}

function save(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function trackPosition(entry) {
  const state = load();
  const id = entry.position_id || entry.token_id || entry.id;
  state.positions[id] = {
    ...entry,
    position_id: id,
    deployed_at: entry.deployed_at || new Date().toISOString(),
    closed: false,
    peak_pnl_pct: 0,
    trailing_active: false,
    out_of_range_since: null,
    total_fees_claimed_usd: 0,
    notes: [],
  };
  save(state);
  log("state", `Tracked position ${id} on ${entry.chain}/${entry.dex}`);
  return state.positions[id];
}

export function recordClose(positionId, reason) {
  const state = load();
  const pos = state.positions[positionId];
  if (!pos) return;
  pos.closed = true;
  pos.closed_at = new Date().toISOString();
  pos.close_reason = reason;
  pos.notes.push(`Closed: ${reason}`);
  save(state);
  log("state", `Closed ${positionId}: ${reason}`);
}

export function updatePeak(positionId, pnlPct) {
  const state = load();
  const pos = state.positions[positionId];
  if (!pos || pos.closed || pnlPct == null) return pos;
  if (pnlPct > (pos.peak_pnl_pct ?? 0)) pos.peak_pnl_pct = pnlPct;
  if (
    !pos.trailing_active &&
    (pos.peak_pnl_pct ?? 0) >= (pos.trailing_trigger_pct ?? 3)
  ) {
    pos.trailing_active = true;
  }
  save(state);
  return pos;
}

export function markOutOfRange(positionId, isOor) {
  const state = load();
  const pos = state.positions[positionId];
  if (!pos || pos.closed) return;
  if (isOor && !pos.out_of_range_since) {
    pos.out_of_range_since = new Date().toISOString();
    save(state);
  } else if (!isOor && pos.out_of_range_since) {
    pos.out_of_range_since = null;
    save(state);
  }
}

export function minutesOutOfRange(positionId) {
  const state = load();
  const pos = state.positions[positionId];
  if (!pos?.out_of_range_since) return 0;
  return Math.floor((Date.now() - new Date(pos.out_of_range_since).getTime()) / 60000);
}

export function getOpenPositions() {
  const state = load();
  return Object.values(state.positions).filter((p) => !p.closed);
}

export function getTrackedPosition(id) {
  return load().positions[id] || null;
}

export function getStateSummary() {
  const open = getOpenPositions();
  return {
    open_positions: open.length,
    positions: open.map((p) => ({
      id: p.position_id,
      pair: p.pair,
      chain: p.chain,
      dex: p.dex,
      amount_native: p.amount_native,
      deployed_at: p.deployed_at,
      dry_run: p.dry_run || false,
    })),
  };
}
