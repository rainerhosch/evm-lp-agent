/**
 * CoinGecko price feed — native + optional ERC20 → USD.
 *
 * Free / Demo: https://api.coingecko.com/api/v3
 * Pro:         https://pro-api.coingecko.com/api/v3
 * Docs:        https://docs.coingecko.com/reference/simple-price
 *
 * Env:
 *   COINGECKO_API_KEY   — demo or pro key (optional; public free works with rate limits)
 *   COINGECKO_API_BASE  — override base URL
 *   COINGECKO_PRO=true  — use pro base + x-cg-pro-api-key header
 */
import { config } from "../config.js";
import { log } from "../logger.js";

const CACHE_TTL_MS = Number(process.env.COINGECKO_CACHE_TTL_MS || 60_000);
const _priceCache = new Map(); // key → { at, value }

function apiBase() {
  if (process.env.COINGECKO_API_BASE) return process.env.COINGECKO_API_BASE.replace(/\/$/, "");
  if (config.prices?.pro || process.env.COINGECKO_PRO === "true") {
    return "https://pro-api.coingecko.com/api/v3";
  }
  return "https://api.coingecko.com/api/v3";
}

function apiHeaders() {
  const key =
    process.env.COINGECKO_API_KEY ||
    config.prices?.apiKey ||
    "";
  const headers = { Accept: "application/json" };
  if (!key) return headers;
  if (config.prices?.pro || process.env.COINGECKO_PRO === "true") {
    headers["x-cg-pro-api-key"] = key;
  } else {
    // Demo API key header (CoinGecko demo plan)
    headers["x-cg-demo-api-key"] = key;
  }
  return headers;
}

function cacheGet(key) {
  const hit = _priceCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    _priceCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  _priceCache.set(key, { at: Date.now(), value });
  return value;
}

async function cgFetch(path) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CoinGecko ${res.status}: ${body.slice(0, 180)}`);
  }
  return res.json();
}

/**
 * CoinGecko asset id for the chain's native gas token.
 */
export function nativeCoinGeckoId(chain = config.chain) {
  const c = typeof chain === "string" ? { id: chain } : chain;
  if (c.coingeckoId) return c.coingeckoId;
  // ETH-gas L2s + ethereum use "ethereum"; BSC uses BNB
  if (c.id === "bsc" || c.nativeSymbol === "BNB") return "binancecoin";
  if (c.nativeSymbol === "ETH" || c.nativeSymbol === "WETH") return "ethereum";
  return c.coingeckoId || "ethereum";
}

/**
 * CoinGecko platform slug for token_price-by-contract.
 * Robinhood may not be listed — returns null (use native eth price only).
 */
export function coingeckoPlatformId(chain = config.chain) {
  const c = typeof chain === "string" ? { id: chain } : chain;
  if (c.coingeckoPlatform) return c.coingeckoPlatform;
  const map = {
    ethereum: "ethereum",
    base: "base",
    arbitrum: "arbitrum-one",
    bsc: "binance-smart-chain",
    robinhood: null, // not on CoinGecko platforms list yet
  };
  return map[c.id] ?? null;
}

/**
 * Spot USD price for one or more CoinGecko coin ids.
 * @param {string|string[]} ids
 * @returns {Promise<Record<string, number|null>>}
 */
export async function getUsdPrices(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (!list.length) return {};

  const missing = [];
  const out = {};
  for (const id of list) {
    const cached = cacheGet(`id:${id}`);
    if (cached != null) out[id] = cached;
    else missing.push(id);
  }
  if (!missing.length) return out;

  try {
    const q = encodeURIComponent(missing.join(","));
    const data = await cgFetch(`/simple/price?ids=${q}&vs_currencies=usd`);
    for (const id of missing) {
      const px = data?.[id]?.usd;
      const n = Number(px);
      const val = Number.isFinite(n) ? n : null;
      if (val != null) cacheSet(`id:${id}`, val);
      out[id] = val;
    }
  } catch (e) {
    log("coingecko_error", e.message);
    for (const id of missing) out[id] = out[id] ?? null;
  }
  return out;
}

/**
 * Real-time native gas token USD price for a chain.
 * @returns {Promise<{ price_usd: number|null, coin_id: string, source: string, cached: boolean }>}
 */
export async function getNativeUsdPrice(chain = config.chain) {
  const coinId = nativeCoinGeckoId(chain);
  const cacheKey = `id:${coinId}`;
  const wasCached = cacheGet(cacheKey) != null;
  const prices = await getUsdPrices(coinId);
  return {
    price_usd: prices[coinId] ?? null,
    coin_id: coinId,
    source: "coingecko",
    cached: wasCached,
    symbol: typeof chain === "object" ? chain.nativeSymbol : "ETH",
  };
}

/**
 * Convert native amount → USD using live CoinGecko price.
 */
export async function nativeToUsd(amountNative, chain = config.chain) {
  const amount = Number(amountNative);
  if (!Number.isFinite(amount)) {
    return { amount_native: amountNative, amount_usd: null, price_usd: null };
  }
  const { price_usd, coin_id } = await getNativeUsdPrice(chain);
  if (price_usd == null) {
    return { amount_native: amount, amount_usd: null, price_usd: null, coin_id };
  }
  return {
    amount_native: amount,
    amount_usd: roundUsd(amount * price_usd),
    price_usd,
    coin_id,
  };
}

/**
 * Convert USD → native amount.
 */
export async function usdToNative(amountUsd, chain = config.chain) {
  const usd = Number(amountUsd);
  const { price_usd, coin_id } = await getNativeUsdPrice(chain);
  if (!Number.isFinite(usd) || price_usd == null || price_usd <= 0) {
    return { amount_usd: usd, amount_native: null, price_usd, coin_id };
  }
  return {
    amount_usd: usd,
    amount_native: parseFloat((usd / price_usd).toFixed(8)),
    price_usd,
    coin_id,
  };
}

/**
 * Token prices by contract on a CoinGecko platform.
 * @param {string[]} contracts
 * @param {string|null} platform
 */
export async function getTokenUsdPrices(contracts, platform = null) {
  const plat = platform || coingeckoPlatformId(config.chain);
  if (!plat) {
    return { platform: null, prices: {}, error: "No CoinGecko platform for this chain" };
  }
  const list = (contracts || []).map((c) => String(c).toLowerCase()).filter(Boolean);
  if (!list.length) return { platform: plat, prices: {} };

  const missing = [];
  const prices = {};
  for (const addr of list) {
    const cached = cacheGet(`tok:${plat}:${addr}`);
    if (cached != null) prices[addr] = cached;
    else missing.push(addr);
  }
  if (!missing.length) return { platform: plat, prices };

  try {
    const q = encodeURIComponent(missing.join(","));
    const data = await cgFetch(
      `/simple/token_price/${plat}?contract_addresses=${q}&vs_currencies=usd`,
    );
    for (const addr of missing) {
      const px = data?.[addr]?.usd ?? data?.[addr.toLowerCase()]?.usd;
      const n = Number(px);
      const val = Number.isFinite(n) ? n : null;
      if (val != null) cacheSet(`tok:${plat}:${addr}`, val);
      prices[addr] = val;
    }
  } catch (e) {
    log("coingecko_error", e.message);
    for (const addr of missing) prices[addr] = prices[addr] ?? null;
  }
  return { platform: plat, prices };
}

export function roundUsd(n, digits = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 10 ** digits) / 10 ** digits;
}

/** Clear price cache (tests / force refresh). */
export function clearPriceCache() {
  _priceCache.clear();
}
