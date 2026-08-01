import { config } from "../config.js";
import { log } from "../logger.js";
import { RSI, BollingerBands } from "technicalindicators";

const DEFAULT_INTERVALS = ["15_MINUTE"];
const DEFAULT_CANDLES = 200;

function safeNum(value) {
  return typeof value === "number" && !isNaN(value) ? value : null;
}

/**
 * Fetch OHLCV from GeckoTerminal and compute indicators locally.
 */
async function fetchChartIndicatorsForPool(pool_address, { interval = "15_MINUTE", candles = DEFAULT_CANDLES } = {}) {
  const geckoNetwork = config.screening.geckoNetwork;
  if (!geckoNetwork) {
    throw new Error(`No GeckoTerminal network configured for ${config.chain.name}.`);
  }

  // Map 15_MINUTE to minute?aggregate=15
  let endpoint = "minute?aggregate=15";
  if (interval === "5_MINUTE") endpoint = "minute?aggregate=5";
  if (interval === "1_HOUR") endpoint = "hour?aggregate=1";

  const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/pools/${pool_address.toLowerCase()}/ohlcv/${endpoint}&limit=${candles}`;
  
  const res = await fetch(url, { headers: { "Accept": "application/json;version=20230302" } });
  if (!res.ok) throw new Error(`GeckoTerminal API error ${res.status}`);
  
  const json = await res.json();
  // GeckoTerminal returns data ordered by newest first: [timestamp, open, high, low, close, volume]
  const ohlcv = json.data?.attributes?.ohlcv_list || [];
  if (ohlcv.length === 0) throw new Error("No OHLCV data returned");

  // We need oldest first for indicator calculation
  ohlcv.reverse();

  const closes = ohlcv.map(row => row[4]);

  // Calculate Indicators
  const rsiInput = { values: closes, period: config.indicators?.rsiLength || 14 };
  const bbInput = { period: 20, values: closes, stdDev: 2 };
  
  const rsiResult = RSI.calculate(rsiInput);
  const bbResult = BollingerBands.calculate(bbInput);

  // Get the latest values
  const currentClose = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2];
  
  const currentRSI = rsiResult[rsiResult.length - 1];
  const currentBB = bbResult[bbResult.length - 1];

  return {
    latest: {
      candle: { close: currentClose },
      previousCandle: { close: previousClose },
      rsi: { value: currentRSI },
      bollinger: {
        lower: currentBB?.lower,
        middle: currentBB?.middle,
        upper: currentBB?.upper
      }
    }
  };
}

function buildSignalSummary(payload) {
  const latest = payload?.latest || {};
  const candle = latest?.candle || {};
  const previousCandle = latest?.previousCandle || {};
  const rsi = safeNum(latest?.rsi?.value);
  const bollinger = latest?.bollinger || {};
  
  return {
    close: safeNum(candle.close),
    previousClose: safeNum(previousCandle.close),
    rsi,
    lowerBand: safeNum(bollinger.lower),
    middleBand: safeNum(bollinger.middle),
    upperBand: safeNum(bollinger.upper),
  };
}

function evaluatePreset(side, preset, payload) {
  const summary = buildSignalSummary(payload);
  const oversold = Number(config.indicators?.rsiOversold ?? 30);
  const overbought = Number(config.indicators?.rsiOverbought ?? 70);
  
  const close = summary.close;
  const lowerBand = summary.lowerBand;
  const upperBand = summary.upperBand;
  const rsi = summary.rsi;

  switch (preset) {
    case "rsi_reversal":
      return side === "entry"
        ? {
            confirmed: rsi != null && rsi <= oversold,
            reason: `RSI ${Math.round(rsi)} <= oversold ${oversold}`,
            signal: summary,
          }
        : {
            confirmed: rsi != null && rsi >= overbought,
            reason: `RSI ${Math.round(rsi)} >= overbought ${overbought}`,
            signal: summary,
          };
    case "bollinger_reversion":
      return side === "entry"
        ? {
            confirmed: close != null && lowerBand != null && close <= lowerBand,
            reason: `Close ${close} <= lower band ${Math.round(lowerBand)}`,
            signal: summary,
          }
        : {
            confirmed: close != null && upperBand != null && close >= upperBand,
            reason: `Close ${close} >= upper band ${Math.round(upperBand)}`,
            signal: summary,
          };
    case "bb_plus_rsi":
      return side === "entry"
        ? {
            confirmed: close != null && lowerBand != null && close <= lowerBand && rsi != null && rsi <= oversold,
            reason: "Close at/below lower band with RSI oversold",
            signal: summary,
          }
        : {
            confirmed: close != null && upperBand != null && close >= upperBand && rsi != null && rsi >= overbought,
            reason: "Close at/above upper band with RSI overbought",
            signal: summary,
          };
    default:
      return {
        confirmed: true, // Default to true if unknown preset
        reason: `Unknown preset ${preset}, bypassing`,
        signal: summary,
      };
  }
}

export async function confirmIndicatorPreset({
  pool_address,
  side,
  preset = side === "entry" ? (config.indicators?.entryPreset || "rsi_reversal") : (config.indicators?.exitPreset || "rsi_reversal"),
  intervals = config.indicators?.intervals || DEFAULT_INTERVALS
} = {}) {
  const results = [];
  for (const interval of intervals) {
    try {
      const payload = await fetchChartIndicatorsForPool(pool_address, { interval });
      const evaluation = evaluatePreset(side, preset, payload);
      results.push({
        interval,
        ok: true,
        confirmed: !!evaluation.confirmed,
        reason: evaluation.reason,
        signal: evaluation.signal,
      });
    } catch (error) {
      log("indicators_warn", `Indicator fetch failed for ${pool_address} ${interval}: ${error.message}`);
      results.push({
        interval,
        ok: false,
        confirmed: null,
        reason: error.message,
      });
    }
  }

  const successful = results.filter((entry) => entry.ok);
  if (successful.length === 0) {
    return {
      confirmed: true,
      skipped: true,
      reason: "Indicator data unavailable; bypassing",
      intervals: results,
    };
  }

  const confirmed = successful.some((entry) => entry.confirmed);

  return {
    confirmed,
    skipped: false,
    preset,
    side,
    reason: confirmed
      ? `${preset} confirmed on ${successful.filter((entry) => entry.confirmed).map((entry) => entry.interval).join(", ")}`
      : `${preset} not confirmed on ${successful.map((entry) => entry.interval).join(", ")}`,
    intervals: results,
  };
}
