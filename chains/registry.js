/**
 * Chain + DEX registry for Uniswap V3 family and PancakeSwap V3.
 *
 * "Robinhood on Uniswap" is treated as Ethereum mainnet Uniswap V3
 * (primary CEX-adjacent retail flow often settles on ETH/L2 Uniswap).
 * BSC uses PancakeSwap V3.
 */

export const CHAINS = {
  ethereum: {
    id: "ethereum",
    chainId: 1,
    name: "Ethereum",
    nativeSymbol: "ETH",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    explorer: "https://etherscan.io",
    geckoNetwork: "eth",
    dexscreener: "ethereum",
    defaultDex: "uniswap_v3",
    npm: "NonfungiblePositionManager",
  },
  base: {
    id: "base",
    chainId: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    explorer: "https://basescan.org",
    geckoNetwork: "base",
    dexscreener: "base",
    defaultDex: "uniswap_v3",
  },
  arbitrum: {
    id: "arbitrum",
    chainId: 42161,
    name: "Arbitrum One",
    nativeSymbol: "ETH",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    explorer: "https://arbiscan.io",
    geckoNetwork: "arbitrum",
    dexscreener: "arbitrum",
    defaultDex: "uniswap_v3",
  },
  bsc: {
    id: "bsc",
    chainId: 56,
    name: "BNB Smart Chain",
    nativeSymbol: "BNB",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    explorer: "https://bscscan.com",
    geckoNetwork: "bsc",
    dexscreener: "bsc",
    defaultDex: "pancakeswap_v3",
  },
  robinhood: {
    id: "robinhood",
    chainId: 4663,
    name: "Robinhood",
    nativeSymbol: "ETH",
    wrappedNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    explorer: "https://robinhoodchain.blockscout.com/",
    geckoNetwork: "eth",
    dexscreener: "ethereum",
    defaultDex: "uniswap_v3",
    npm: "NonfungiblePositionManager",
  },
};

/** Official NonfungiblePositionManager addresses (Uniswap V3 / Pancake V3). */
export const DEXES = {
  uniswap_v3: {
    id: "uniswap_v3",
    name: "Uniswap V3",
    kind: "univ3",
    /** chainId → NPM address */
    positionManager: {
      1: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      8453: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
      42161: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      4663: "0x73991a25c818bf1f1128deaab1492d45638de0d3"

    },
    factory: {
      1: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      8453: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
      42161: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      4663: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa"
    },
    feeTiers: [100, 500, 3000, 10000],
  },
  pancakeswap_v3: {
    id: "pancakeswap_v3",
    name: "PancakeSwap V3",
    kind: "univ3",
    positionManager: {
      56: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    },
    factory: {
      56: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    },
    // Pancake uses same fee notion (1e-6) as Uni V3 for common tiers
    feeTiers: [100, 500, 2500, 10000],
  },
};

export function resolveChain(chainIdOrName) {
  const key = String(chainIdOrName || "ethereum").toLowerCase();
  if (CHAINS[key]) return CHAINS[key];
  const byId = Object.values(CHAINS).find((c) => String(c.chainId) === key);
  if (byId) return byId;
  throw new Error(`Unknown chain: ${chainIdOrName}. Use ethereum | bsc | base | arbitrum`);
}

export function resolveDex(chain, dexHint = "auto") {
  const chainInfo = typeof chain === "string" ? resolveChain(chain) : chain;
  let dexId = dexHint;
  if (!dexId || dexId === "auto") dexId = chainInfo.defaultDex;
  const dex = DEXES[dexId];
  if (!dex) throw new Error(`Unknown dex: ${dexId}`);
  const pm = dex.positionManager[chainInfo.chainId];
  if (!pm) {
    throw new Error(`${dex.name} is not configured on ${chainInfo.name} (chainId ${chainInfo.chainId})`);
  }
  return {
    ...dex,
    positionManagerAddress: pm,
    factoryAddress: dex.factory[chainInfo.chainId] || null,
    chain: chainInfo,
  };
}

export function listSupportedMarkets() {
  return [
    { chain: "ethereum", dex: "uniswap_v3", note: "ETH mainnet Uniswap V3 (primary)" },
    { chain: "base", dex: "uniswap_v3", note: "Base Uniswap V3" },
    { chain: "arbitrum", dex: "uniswap_v3", note: "Arbitrum Uniswap V3" },
    { chain: "bsc", dex: "pancakeswap_v3", note: "BNB Chain PancakeSwap V3" },
    { chain: "robinhood", dex: "uniswap_v3", note: "Robinhood Uniswap V3" },
  ];
}
