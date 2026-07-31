import { scorePool, shouldApplyHardTakeProfit, effectiveTrailingDropPct, clamp } from "../risk.js";

function assert(c, m) {
  if (!c) throw new Error(m);
}

assert(clamp(5, 0, 3) === 3, "clamp");
assert(shouldApplyHardTakeProfit({ trailingTakeProfit: true, hardTakeProfitWhileTrailing: false, takeProfitPct: 8 }) === false, "hard tp off");
assert(shouldApplyHardTakeProfit({ trailingTakeProfit: false, takeProfitPct: 8 }) === true, "hard tp on");

const a = scorePool({ tvl_usd: 1e6, volume_24h_usd: 5e5, fee_apr_pct: 40 });
const b = scorePool({ tvl_usd: 1e6, volume_24h_usd: 1e4, fee_apr_pct: 2 });
assert(a > b, "higher fee/vol scores higher");

const drop = effectiveTrailingDropPct(10, { trailingDropPct: 1.5, trailingTriggerPct: 3 });
assert(drop > 1.5, "trail widens");

console.log("✓ risk tests passed");
