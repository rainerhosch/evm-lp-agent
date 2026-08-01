import { config } from "../config.js";
import { log } from "../logger.js";

/**
 * Study historical performance for an EVM pool using GeckoTerminal OHLCV.
 * This avoids relying on unreliable or rate-limited GraphQL subgraphs.
 */
export async function studyTopLPers({ pool_address, limit = 30 }) {
  const geckoNetwork = config.screening.geckoNetwork;
  let data = [];
  let useDexScreenerFallback = false;

  // Try GeckoTerminal first if network is configured
  if (geckoNetwork) {
    const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/pools/${pool_address.toLowerCase()}/ohlcv/day?aggregate=1&limit=${limit}`;
    try {
      const res = await fetch(url, { headers: { "Accept": "application/json;version=20230302" } });
      if (res.ok) {
        const json = await res.json();
        data = json.data?.attributes?.ohlcv_list || [];
      } else {
        useDexScreenerFallback = true;
      }
    } catch (e) {
      useDexScreenerFallback = true;
    }
  } else {
    useDexScreenerFallback = true;
  }

  // If GeckoTerminal failed or returned empty data, try DexScreener
  if (useDexScreenerFallback || data.length === 0) {
    const dexNetwork = config.chain.dexscreener || config.chain.id;
    try {
      const dexUrl = `https://api.dexscreener.com/latest/dex/pairs/${dexNetwork}/${pool_address}`;
      const res = await fetch(dexUrl);
      if (res.ok) {
        const json = await res.json();
        const pair = json.pairs && json.pairs[0];
        if (pair) {
          log("study", `Fallback to DexScreener for ${pool_address}`);
          const vol24h = pair.volume?.h24 || 0;
          const change24h = pair.priceChange?.h24 || 0;
          const price = parseFloat(pair.priceUsd || "0");
          const highEst = price * (1 + Math.abs(change24h) / 100);
          const lowEst = price * (1 - Math.abs(change24h) / 100);
          
          return {
            pool: pool_address,
            message: "Historical OHLCV unavailable. Fallback to 24h DexScreener snapshot.",
            patterns: {
              days_analyzed: 1,
              avg_daily_volume: Math.round(vol24h),
              volatility_daily_pct: Math.abs(change24h),
              overall_trend_pct: change24h,
              price_range: { high: highEst, low: lowEst }
            },
            lpers: []
          };
        }
      }
    } catch (e) {
      log("study_error", `DexScreener fallback failed: ${e.message}`);
    }
    
    return {
      pool: pool_address,
      message: "No historical OHLCV or DexScreener data found for this pool.",
      patterns: {},
      lpers: [],
    };
  }

  // Process GeckoTerminal OHLCV format: [timestamp, open, high, low, close, volume]
  let totalVolume = 0;
  let maxPrice = 0;
  let minPrice = Infinity;
  let priceChanges = [];

  const days = data.map(row => {
    const [ts, o, h, l, c, v] = row;
    totalVolume += v;
    if (h > maxPrice) maxPrice = h;
    if (l < minPrice) minPrice = l;
    
    // Day over day change
    const pctChange = o > 0 ? ((c - o) / o) * 100 : 0;
    priceChanges.push(pctChange);
    
    return {
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: o,
      close: c,
      volume: v,
      change_pct: pctChange
    };
  });

  const avgVolume = totalVolume / days.length;
  
  // Calculate historical volatility (standard deviation of daily returns)
  let volatility = 0;
  if (priceChanges.length > 0) {
    const meanChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const variance = priceChanges.reduce((a, b) => a + Math.pow(b - meanChange, 2), 0) / priceChanges.length;
    volatility = Math.sqrt(variance);
  }

  // Overall trend
  const oldestClose = days[days.length - 1].close;
  const newestClose = days[0].close;
  const overallTrendPct = oldestClose > 0 ? ((newestClose - oldestClose) / oldestClose) * 100 : 0;

  const patterns = {
    days_analyzed: days.length,
    avg_daily_volume: Math.round(avgVolume),
    volatility_daily_pct: Math.round(volatility * 100) / 100,
    overall_trend_pct: Math.round(overallTrendPct * 100) / 100,
    price_range: {
      high: maxPrice,
      low: minPrice
    }
  };

  return {
    pool: pool_address,
    message: `Historical study based on public OHLCV data from GeckoTerminal (${days.length} days).`,
    patterns,
    lpers: [], // LPer tracking is not available via public OHLCV
  };
}
