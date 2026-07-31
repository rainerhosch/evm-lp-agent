import { config } from "../config.js";
import { log } from "../logger.js";

/**
 * Study historical performance for an EVM pool using GeckoTerminal OHLCV.
 * This avoids relying on unreliable or rate-limited GraphQL subgraphs.
 */
export async function studyTopLPers({ pool_address, limit = 30 }) {
  const geckoNetwork = config.chain.geckoNetwork;
  if (!geckoNetwork) {
    return {
      pool: pool_address,
      message: `Study mode unavailable: No GeckoTerminal network ID configured for ${config.chain.name}.`,
      patterns: {},
      lpers: [],
    };
  }

  // Fetch daily OHLCV for the last 30 days
  const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/pools/${pool_address.toLowerCase()}/ohlcv/day?aggregate=1&limit=${limit}`;

  let data;
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json;version=20230302"
      }
    });

    if (!res.ok) {
      throw new Error(`GeckoTerminal API error ${res.status}`);
    }

    const json = await res.json();
    data = json.data?.attributes?.ohlcv_list || [];
  } catch (error) {
    log("study_error", `Failed to fetch from GeckoTerminal: ${error.message}`);
    return {
      pool: pool_address,
      message: `Failed to fetch public historical data: ${error.message}`,
      patterns: {},
      lpers: [],
    };
  }

  if (!data.length) {
    return {
      pool: pool_address,
      message: "No historical OHLCV data found for this pool on GeckoTerminal.",
      patterns: {},
      lpers: [],
    };
  }

  // OHLCV format: [timestamp, open, high, low, close, volume]
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
  const meanChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
  const variance = priceChanges.reduce((a, b) => a + Math.pow(b - meanChange, 2), 0) / priceChanges.length;
  const volatility = Math.sqrt(variance);

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
