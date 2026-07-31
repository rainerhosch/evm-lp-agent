# Concentrated liquidity concepts (V3 family)

Applies to **Uniswap V3** and **PancakeSwap V3** (same CLAMM design).

## Core ideas

1. **Ticks** — discrete price points. Liquidity is active only when the pool price tick is inside `[tickLower, tickUpper]`.
2. **Fee tiers** — separate pools per fee (e.g. 100 / 500 / 3000 / 10000 = 0.01% / 0.05% / 0.3% / 1%).
3. **Position = NFT** — owned by `NonfungiblePositionManager` (ERC-721). Stores range, liquidity, fee growth snapshots.
4. **In range vs OOR** — if current tick exits the range, the position stops earning swap fees and becomes single-asset.

## Fee math (intuition)

- Fees accrue to LPs **pro-rata while in range**.
- Realized fee APR ≈ `volume × fee_rate / active_liquidity` over time — not the same as listing APR.
- Tighter ranges → higher fee capture **if** price stays inside; higher OOR / IL risk.

## Position lifecycle (NPM)

Official Uniswap guide sequence:

1. **Approve** token0 / token1 for NPM (if not native path)
2. **`mint`** — create NFT + add liquidity  
   Params: `token0`, `token1`, `fee`, `tickLower`, `tickUpper`, `amount0Desired`, `amount1Desired`, mins, `recipient`, `deadline`
3. **`increaseLiquidity`** — add more to existing tokenId
4. **`decreaseLiquidity`** — burn liquidity (tokens stay in NPM until collect)
5. **`collect`** — withdraw tokensOwed (principal + fees)
6. **`burn`** — destroy empty NFT

Pancake V3: same flow; NPM address differs (see official-docs.md).

## Tick spacing

- Fee tier implies tick spacing (e.g. 0.3% → spacing 60 on Uni V3).
- `tickLower` / `tickUpper` must be multiples of spacing.
- Agent config `tickRangeWidth` is a **desired width in ticks**; clamp to spacing before mint.

## Token ordering

- Always `token0 < token1` by address (uint160 sort).
- Amounts must match sorted order when calling `mint`.

## Price / slot0

Read pool `slot0()` → `sqrtPriceX96`, `tick`.  
Compute amounts for a range from liquidity formulas (use `@uniswap/v3-sdk` or `@pancakeswap/v3-sdk` for production).

## V3 vs V4 (do not confuse)

| | V3 | V4 |
|--|----|----|
| Pool deploy | Factory creates pool contracts | Singleton PoolManager |
| Positions | NPM ERC-721 | New position managers / hooks |
| Customization | Fixed fee tiers | Hooks |
| Agent v0.1 | **Supported target** | Roadmap only |

## Pancake-specific notes

- MasterChef V3 / LM pools may attach farm rewards on top of swap fees.
- Agent v0.1 optimizes for **swap fee LP**, not CAKE farming stake flows.
- Infinity is Pancake’s modular next gen (like Uni V4) — separate integration.

## Safety for micro wallets

- Mainnet ETH gas can exceed micro LP principal.
- Prefer **Base / BSC** for small capital tests.
- Always keep `gasReserve` in native token after mint.
