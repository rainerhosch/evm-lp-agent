/**
 * Risk helpers for EVM LP agent (mirrors Meridian concepts).
 */

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function effectiveTrailingDropPct(peakPnlPct, mgmt) {
  const base = Number(mgmt.trailingDropPct ?? 1.5);
  const trigger = Number(mgmt.trailingTriggerPct ?? 3);
  const peak = Number(peakPnlPct ?? 0);
  if (!Number.isFinite(peak) || peak <= trigger) return base;
  // Mild widen for runners
  return clamp(base + (peak - trigger) * 0.1, 0.3, 5);
}

export function shouldApplyHardTakeProfit(mgmt) {
  if (mgmt.trailingTakeProfit && mgmt.hardTakeProfitWhileTrailing !== true) return false;
  return Number(mgmt.takeProfitPct) > 0;
}

/**
 * Rank V3 pool candidates: fee APR proxy, TVL, volume, concentration of fee tier.
 */
export function scorePool(pool) {
  const tvl = Number(pool.tvl_usd || 0);
  const vol = Number(pool.volume_24h_usd || 0);
  const apr = Number(pool.fee_apr_pct || 0);
  const volTvl = tvl > 0 ? vol / tvl : 0;
  // Prefer productive fee farms over pure TVL giants
  return apr * 2 + volTvl * 50 + Math.log10(Math.max(tvl, 1)) * 5;
}

export function checkExitRules(position, mgmt) {
  const pnl = position.pnl_pct;
  if (pnl == null) return null;

  if (pnl <= Number(mgmt.stopLossPct ?? -25)) {
    return { action: "CLOSE", reason: `stop loss ${pnl}%` };
  }

  if (position.trailing_active) {
    const peak = Number(position.peak_pnl_pct ?? 0);
    const drop = effectiveTrailingDropPct(peak, mgmt);
    if (peak - pnl >= drop) {
      return { action: "CLOSE", reason: `trailing TP peak ${peak}% → ${pnl}%` };
    }
  }

  if (shouldApplyHardTakeProfit(mgmt) && pnl >= Number(mgmt.takeProfitPct)) {
    return { action: "CLOSE", reason: `take profit ${pnl}%` };
  }

  if (position.minutes_out_of_range >= Number(mgmt.outOfRangeWaitMinutes ?? 30)) {
    return { action: "CLOSE", reason: `OOR ${position.minutes_out_of_range}m` };
  }

  if (
    Number(mgmt.maxHoldMinutes) > 0 &&
    (position.age_minutes ?? 0) >= mgmt.maxHoldMinutes &&
    !(position.trailing_active && pnl >= Number(mgmt.trailingTriggerPct ?? 3))
  ) {
    return { action: "CLOSE", reason: "max hold / capital rotation" };
  }

  return null;
}
