# EVM LP risk rules (agent)

Implemented in `risk.js` + `index.js` management cycle.

## Deploy sizing

```
deploy = clamp((native - gasReserve) * positionSizePct, deployAmountNative, maxDeployAmount)
```

Micro defaults: deploy **0.015**, gas **0.006**, maxPositions **1**.

## Exit priority

1. Stop loss (`stopLossPct`, default −25%)
2. Trailing TP (after `trailingTriggerPct`; drop = base + mild widen)
3. Hard take-profit only if trailing is **off**
4. Out-of-range wait (`outOfRangeWaitMinutes`)
5. Max hold / capital rotation (`maxHoldMinutes`) unless strong trailing runner
6. Claim fees if unclaimed ≥ `minClaimAmountUsd` (when live PnL wired)

## Screening rank

`scorePool` prefers:

- Higher fee APR proxy  
- Higher volume/TVL  
- Log TVL floor (avoid dust)

Hard filters: `minTvlUsd`, `minVolume24hUsd`, `minFeeAprPct`.

## Live vs dry

| Mode | Behavior |
|------|----------|
| DRY_RUN | State-only mint/close; no chain txs |
| Live | Gated until `tools/univ3.js` completes tick math + approvals |

## Gas awareness

Ethereum mainnet: gas can dominate micro positions. Prefer Base/BSC for small funds.
