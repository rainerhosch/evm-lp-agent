# Live mint checklist (Uniswap V3 / Pancake V3)

Follow official guides:

- Uni: https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position  
- Cake agents: https://docs.pancakeswap.finance/trading-tools/building-trading-agents-on-pancakeswap-v3  

## Pre-flight

- [ ] `DRY_RUN=false` intentional  
- [ ] Correct `EVM_CHAIN` + RPC  
- [ ] Wallet native ≥ deploy + gasReserve + buffer  
- [ ] NPM address matches official deployments for chain  
- [ ] Pool is V3 (not V2 / Infinity / V4 unless separate code path)  
- [ ] Token0 & token1 sorted by address  
- [ ] Fee tier matches pool  
- [ ] tickLower / tickUpper multiples of tickSpacing  
- [ ] amount0Desired / amount1Desired from current slot0 + range math  
- [ ] amount0Min / amount1Min slippage set  
- [ ] ERC20 `approve` NPM for required amounts  
- [ ] deadline = now + N minutes  
- [ ] Simulate with `eth_call` / tenderly if possible  

## Mint call shape (NPM)

```text
mint({
  token0, token1, fee,
  tickLower, tickUpper,
  amount0Desired, amount1Desired,
  amount0Min, amount1Min,
  recipient, deadline
})
```

## After mint

- [ ] Store `tokenId` in `state.json` with pool, ticks, amounts, chain, dex  
- [ ] Verify `positions(tokenId)` liquidity > 0  
- [ ] Set management interval based on volatility  

## Close path

1. `decreaseLiquidity` (full liquidity)  
2. `collect` (max uint128 both)  
3. `burn` NFT if empty  

## SDKs (recommended for production)

- `@uniswap/v3-sdk` + `@uniswap/sdk-core`  
- `@pancakeswap/v3-sdk`  

Do not hand-roll Q64.96 math if SDK is available.
