import { ethers } from "ethers";
import { config } from "../config.js";
import { log } from "../logger.js";
import erc20Abi from "../abis/erc20.json" with { type: "json" };
import {
  getNativeUsdPrice,
  getTokenUsdPrices,
  nativeToUsd,
  roundUsd,
} from "./coingecko.js";
import { registerWalletResets } from "../chain-runtime.js";

let _provider = null;
let _wallet = null;
let _resetsRegistered = false;

export function resetProvider() {
  _provider = null;
}
export function resetWallet() {
  _wallet = null;
}

function ensureResetsRegistered() {
  if (_resetsRegistered) return;
  _resetsRegistered = true;
  try {
    registerWalletResets({ resetProvider, resetWallet });
  } catch {
    /* ignore if runtime not ready */
  }
}

export function getProvider() {
  ensureResetsRegistered();
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chain.chainId);
  }
  return _provider;
}

export function getWallet() {
  ensureResetsRegistered();
  if (_wallet) return _wallet;
  const pk = config.privateKey?.trim();
  if (!pk) throw new Error("EVM_PRIVATE_KEY not set in .env");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  _wallet = new ethers.Wallet(key, getProvider());
  return _wallet;
}

export function getAddress() {
  try {
    return getWallet().address;
  } catch {
    return null;
  }
}

/**
 * Native + optional ERC20 balances, with CoinGecko USD estimates.
 */
export async function getWalletBalances({ tokens = [] } = {}) {
  const chain = config.chain;
  let address;
  try {
    address = getWallet().address;
  } catch (e) {
    return {
      wallet: null,
      chain: chain.id,
      native: 0,
      native_symbol: chain.nativeSymbol,
      native_price_usd: null,
      native_usd: null,
      tokens: [],
      error: e.message,
    };
  }

  try {
    const provider = getProvider();
    const balWei = await provider.getBalance(address);
    const native = Number(ethers.formatEther(balWei));

    // Live native → USD via CoinGecko (ETH or BNB depending on chain)
    let native_price_usd = null;
    let native_usd = null;
    let price_source = null;
    try {
      const px = await getNativeUsdPrice(chain);
      native_price_usd = px.price_usd;
      price_source = px.source;
      if (native_price_usd != null) {
        native_usd = roundUsd(native * native_price_usd);
      }
    } catch (e) {
      log("wallet_warn", `native price: ${e.message}`);
    }

    const tokenRows = [];
    const mints = [];
    for (const mint of tokens) {
      try {
        const c = new ethers.Contract(mint, erc20Abi, provider);
        const [raw, decimals, symbol] = await Promise.all([
          c.balanceOf(address),
          c.decimals(),
          c.symbol(),
        ]);
        const balance = Number(ethers.formatUnits(raw, decimals));
        tokenRows.push({
          mint,
          symbol,
          balance,
          decimals: Number(decimals),
          price_usd: null,
          usd: null,
        });
        mints.push(String(mint).toLowerCase());
      } catch (err) {
        tokenRows.push({ mint, error: err.message });
      }
    }

    // Optional ERC20 USD via CoinGecko token_price (when platform known)
    if (mints.length) {
      try {
        const { prices } = await getTokenUsdPrices(mints, chain.coingeckoPlatform);
        for (const row of tokenRows) {
          if (!row.mint || row.error) continue;
          const px = prices[String(row.mint).toLowerCase()];
          if (px != null) {
            row.price_usd = px;
            row.usd = roundUsd(row.balance * px);
          }
        }
      } catch (e) {
        log("wallet_warn", `token prices: ${e.message}`);
      }
    }

    const tokens_usd = tokenRows.reduce((s, t) => s + (t.usd || 0), 0);
    const total_usd =
      native_usd != null || tokens_usd > 0
        ? roundUsd((native_usd || 0) + tokens_usd)
        : null;

    return {
      wallet: address,
      chain: chain.id,
      chain_id: chain.chainId,
      dex: config.dex.id,
      native,
      native_symbol: chain.nativeSymbol,
      native_price_usd,
      native_usd,
      price_source,
      total_usd,
      rpc: config.rpcUrl.replace(/\/\/.*@/, "//***@"),
      tokens: tokenRows,
      dry_run: process.env.DRY_RUN === "true" || config.dryRun,
    };
  } catch (error) {
    log("wallet_error", error.message);
    return {
      wallet: address,
      chain: chain.id,
      native: 0,
      native_symbol: chain.nativeSymbol,
      native_price_usd: null,
      native_usd: null,
      tokens: [],
      error: error.message,
    };
  }
}

/** Re-export helpers for CLI / tools. */
export { getNativeUsdPrice, nativeToUsd, getTokenUsdPrices };
