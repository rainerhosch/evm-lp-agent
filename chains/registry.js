/**
 * Chain + DEX registry for Uniswap V3 family and PancakeSwap V3.
 *
 * Robinhood Chain (chainId 4663) is a separate L2 with its own Uniswap V3 deployment.
 * Do NOT point geckoNetwork/dexscreener at ethereum — that returns mainnet pools
 * that do not exist on Robinhood.
 *
 * Docs:
 * - https://blog.uniswap.org/robinhood-chain-is-live
 * - https://docs.robinhood.com/chain/connecting/
 * - GeckoTerminal network id: "robinhood"
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
    // CoinGecko simple/price id + token_price platform
    coingeckoId: "ethereum",
    coingeckoPlatform: "ethereum",
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
    coingeckoId: "ethereum",
    coingeckoPlatform: "base",
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
    coingeckoId: "ethereum",
    coingeckoPlatform: "arbitrum-one",
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
    coingeckoId: "binancecoin",
    coingeckoPlatform: "binance-smart-chain",
  },
  /**
   * Robinhood Chain — Arbitrum-style L2, ETH gas, Uniswap V2/V3/V4 live.
   * chainId 4663 ("hood" on phone keypad). RPC: rpc.mainnet.chain.robinhood.com
   */
  robinhood: {
    id: "robinhood",
    chainId: 4663,
    name: "Robinhood Chain",
    nativeSymbol: "ETH",
    // WETH on Robinhood (verified bytecode on-chain)
    wrappedNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    explorer: "https://robinhoodchain.blockscout.com",
    // CRITICAL: must be "robinhood", not "eth" — eth returns Ethereum mainnet pools
    geckoNetwork: "robinhood",
    dexscreener: "robinhood",
    defaultDex: "uniswap_v3",
    // Native gas is ETH → price via CoinGecko "ethereum"
    coingeckoId: "ethereum",
    // Platform token_price not available yet on CoinGecko
    coingeckoPlatform: null,
    // Newer chain: lower TVL books are normal vs mainnet
    screeningDefaults: {
      minTvlUsd: 5_000,
      minVolume24hUsd: 1_000,
      minFeeAprPct: 1,
    },
  },
  monad: {
    id: "monad",
    chainId: 143,
    name: "Monad",
    nativeSymbol: "MON",
    wrappedNative: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
    explorer: "https://monadexplorer.com",
    geckoNetwork: "monad",
    dexscreener: "monad",
    defaultDex: "uniswap_v3",
    coingeckoId: "monad",
    coingeckoPlatform: "monad",
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
      // Robinhood Chain — verified has contract code + factory feeAmountTickSpacing works
      4663: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
      // Monad
      143: "0x5e325eaB19E52Edf280961726aAca4e022513f54", // Using a placeholder/Uniswap V3 mock NPM for Monad
    },
    factory: {
      1: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      8453: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
      42161: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      4663: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
      143: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    subgraphUrl: {
      1: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      8453: "https://api.studio.thegraph.com/query/45376/uniswap-v3-base/version/latest",
      42161: "https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal",
      4663: null, // No official subgraph for Robinhood yet
      143: null,  // No official subgraph for Monad yet
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
    subgraphUrl: {
      56: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
    },
    // Pancake uses same fee notion (1e-6) as Uni V3 for common tiers
    feeTiers: [100, 500, 2500, 10000],
  },
  uniswap_v4: {
    id: "uniswap_v4",
    name: "Uniswap V4",
    kind: "univ4",
    // V4 uses a singleton PoolManager instead of Factory
    poolManager: {
      1: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      8453: "0x498581ff718922c3f8e6a244956af099b2652b2b",
      42161: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
      4663: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
      143: "0x188d586ddcf52439676ca21a244753fa19f9ea8e", // Mock/placeholder on Monad
    },
    // V4 PositionManager for LP NFT interactions
    positionManager: {
      1: "0xb63D2278fbfC8C8592E56475510620DeD1A8d5dc",
      8453: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
      42161: "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
      4663: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
      143: "0x5b7ec4a94ff9bedb700fb82ab09d5846972f4016", // Mock/placeholder on Monad
    },
    feeTiers: [100, 500, 3000, 10000], // V4 can theoretically support any fee, but we use defaults for bots
    subgraphUrl: {
      // Typically different for V4, using placeholders until official
      1: null,
      8453: null,
      42161: null,
    },
  },
};

export function resolveChain(chainIdOrName) {
  const key = String(chainIdOrName || "ethereum").toLowerCase().trim();
  if (CHAINS[key]) return CHAINS[key];
  const byId = Object.values(CHAINS).find((c) => String(c.chainId) === key);
  if (byId) return byId;
  const known = Object.keys(CHAINS).join(" | ");
  throw new Error(`Unknown chain: ${chainIdOrName}. Use ${known}`);
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
    poolManagerAddress: dex.poolManager?.[chainInfo.chainId] || null,
    factoryAddress: dex.factory?.[chainInfo.chainId] || null,
    subgraphUrl: dex.subgraphUrl?.[chainInfo.chainId] || null,
    chain: chainInfo,
  };
}

export function listSupportedMarkets() {
  return [
    { chain: "ethereum", dex: "uniswap_v3", note: "ETH mainnet Uniswap V3" },
    { chain: "ethereum", dex: "uniswap_v4", note: "ETH mainnet Uniswap V4 (Beta)" },
    { chain: "base", dex: "uniswap_v3", note: "Base Uniswap V3" },
    { chain: "base", dex: "uniswap_v4", note: "Base Uniswap V4 (Beta)" },
    { chain: "arbitrum", dex: "uniswap_v3", note: "Arbitrum Uniswap V3" },
    { chain: "arbitrum", dex: "uniswap_v4", note: "Arbitrum Uniswap V4 (Beta)" },
    { chain: "bsc", dex: "pancakeswap_v3", note: "BNB Chain PancakeSwap V3" },
    { chain: "robinhood", dex: "uniswap_v3", note: "Robinhood Chain Uniswap V3" },
    { chain: "monad", dex: "uniswap_v3", note: "Monad Uniswap V3" },
    { chain: "monad", dex: "uniswap_v4", note: "Monad Uniswap V4 (Beta)" },
  ];
}
