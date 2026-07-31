# Official documentation index (EVM LP agent)

Use these as the **source of truth** for protocol math, contracts, and position lifecycle. Prefer official docs over blog posts.

## Uniswap V3

| Topic | URL |
|-------|-----|
| Concepts — concentrated liquidity | https://docs.uniswap.org/concepts/protocol/concentrated-liquidity |
| Concepts — fees | https://docs.uniswap.org/concepts/protocol/fees |
| Concepts — range orders | https://docs.uniswap.org/concepts/protocol/range-orders |
| Core overview | https://docs.uniswap.org/contracts/v3/overview |
| Core addresses (per chain) | https://docs.uniswap.org/contracts/v3/reference/deployments/ |
| NonfungiblePositionManager reference | https://docs.uniswap.org/contracts/v3/reference/periphery/NonfungiblePositionManager |
| Guides — providing liquidity | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/setting-up |
| Guides — mint position | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position |
| Guides — collect fees | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/collect-fees |
| Guides — decrease / remove | https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/decrease-liquidity |
| Guides — swap / quoter | https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps |
| SDK — v3-sdk | https://docs.uniswap.org/sdk/v3/overview |
| Subgraph | https://docs.uniswap.org/api/subgraph/overview |

## Uniswap V4

| Topic | URL |
|-------|-----|
| V4 overview | https://docs.uniswap.org/contracts/v4/overview |
| V4 concepts | https://docs.uniswap.org/concepts/protocol/hooks |
| PoolManager / singleton | https://docs.uniswap.org/contracts/v4/concepts/PoolManager |
| Position Manager (v4 periphery) | https://docs.uniswap.org/contracts/v4/overview |
| V4 SDK | https://docs.uniswap.org/sdk/v4/overview |
| V4 deployments | https://docs.uniswap.org/contracts/v4/deployments |

**Agent note:** `evm-lp-agent` v0.1 targets **V3-compatible** NPM mint (Uniswap V3 + Pancake V3). V4 uses a different architecture (hooks + PoolManager + new position managers). Do not mix V3 NPM calls with V4 pools.

## PancakeSwap V3

| Topic | URL |
|-------|-----|
| Developer home | https://developer.pancakeswap.finance/ |
| V3 contracts / FAQ | https://developer.pancakeswap.finance/contracts/v3/faq |
| V3 addresses (NPM etc.) | https://developer.pancakeswap.finance/contracts/v3/addresses |
| V3 SDK | https://developer.pancakeswap.finance/sdks/v3-sdk |
| Smart router SDK | https://developer.pancakeswap.finance/sdks/overview |
| Building trading agents on V3 | https://docs.pancakeswap.finance/trading-tools/building-trading-agents-on-pancakeswap-v3 |
| Subgraph API | https://developer.pancakeswap.finance/apis/subgraph |
| Protocol developers hub | https://docs.pancakeswap.finance/protocol/developers |

## PancakeSwap Infinity (next-gen, analogous to Uni V4)

| Topic | URL |
|-------|-----|
| Infinity product | https://docs.pancakeswap.finance/trade/pancakeswap-infinity |
| Infinity contracts overview | https://developer.pancakeswap.finance/contracts/infinity/overview |
| Infinity addresses | https://developer.pancakeswap.finance/contracts/infinity/resources/addresses |
| Infinity SDK | https://developer.pancakeswap.finance/sdks/overview |

## Supporting APIs (agent screening)

| Source | URL |
|--------|-----|
| GeckoTerminal API | https://www.geckoterminal.com/dex-api |
| The Graph (Uniswap) | https://thegraph.com/docs/ |
| ethers.js v6 | https://docs.ethers.org/v6/ |

## Canonical contract addresses (agent registry)

See also `chains/registry.js` in this repo.

### Uniswap V3 NonfungiblePositionManager (common)

| Chain | chainId | NPM |
|-------|---------|-----|
| Ethereum | 1 | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| Base | 8453 | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |
| Arbitrum | 42161 | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |

### PancakeSwap V3 NonfungiblePositionManager

| Chain | chainId | NPM |
|-------|---------|-----|
| BSC | 56 | `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` |

Always re-verify against official deployments pages before mainnet live mint.
