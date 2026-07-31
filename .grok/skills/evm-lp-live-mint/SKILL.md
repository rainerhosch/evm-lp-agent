---
name: evm-lp-live-mint
description: >
  Implement or execute live Uniswap V3 / Pancake V3 mint/close using official docs
  and SDKs. Use for /evm-lp-live-mint, "implement live mint", "wire NPM mint",
  "finish univ3.js", "enable real pancake deploy".
metadata:
  short-description: "Live V3 mint implementation guide"
---

# Live mint implementation skill

Goal: replace the scaffold in `tools/univ3.js` with production-safe mint/close.

## Official sources (must follow)

### Uniswap V3

1. Setup: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/setting-up  
2. Mint: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position  
3. Collect: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/collect-fees  
4. Decrease: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/decrease-liquidity  
5. NPM API: https://docs.uniswap.org/contracts/v3/reference/periphery/NonfungiblePositionManager  
6. Deployments: https://docs.uniswap.org/contracts/v3/reference/deployments/  
7. SDK: https://docs.uniswap.org/sdk/v3/overview  

### PancakeSwap V3

1. Developer hub: https://developer.pancakeswap.finance/  
2. V3 addresses: https://developer.pancakeswap.finance/contracts/v3/addresses  
3. V3 SDK: https://developer.pancakeswap.finance/sdks/v3-sdk  
4. Agent guide: https://docs.pancakeswap.finance/trading-tools/building-trading-agents-on-pancakeswap-v3  

### Uniswap V4 (future path — separate module)

1. https://docs.uniswap.org/contracts/v4/overview  
2. https://docs.uniswap.org/sdk/v4/overview  
Do **not** bolt V4 onto V3 NPM code.

## Implementation steps

### 1. Dependencies

```bash
npm install @uniswap/v3-sdk @uniswap/sdk-core @uniswap/v3-periphery
# and/or
npm install @pancakeswap/v3-sdk
```

### 2. Read pool state

- `factory.getPool(token0, token1, fee)`  
- Pool `slot0()` → tick, sqrtPriceX96  
- `tickSpacing` from fee  

### 3. Build range

- Center on current tick  
- Width from `config.management.tickRangeWidth`  
- Snap to spacing  

### 4. Compute amounts

Use SDK `Position.fromAmounts` / nearest usable ticks — avoid raw Q64.96 bugs.

### 5. Approvals

- ERC20 `approve(NPM, amount)` for token0/token1  
- Native: wrap to WETH/WBNB if pool needs wrapped only  

### 6. mint

Call NPM `mint` with mins + deadline.  
On success: `trackPosition` with real `tokenId`.

### 7. close

`decreaseLiquidity` → `collect` → `burn`.

### 8. Tests

- Dry-run still works  
- Live on **testnet or Base** first  
- Unit test tick spacing snap  

## Checklist

Complete every box in `.grok/skills/evm-lp/references/live-mint-checklist.md` before mainnet.

## Code touch points

| File | Change |
|------|--------|
| `tools/univ3.js` | Real mint/close/claim |
| `package.json` | SDKs |
| `chains/registry.js` | Confirm addresses |
| `state.js` | Store tokenId, tx hashes |

## Safety

User must set `DRY_RUN=false` explicitly. Confirm gas + amounts before send.
