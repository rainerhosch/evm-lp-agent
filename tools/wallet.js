import { ethers } from "ethers";
import { config } from "../config.js";
import { log } from "../logger.js";
import erc20Abi from "../abis/erc20.json" with { type: "json" };

let _provider = null;
let _wallet = null;

export function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chain.chainId);
  }
  return _provider;
}

export function getWallet() {
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
 * Native + optional ERC20 balances.
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
      native_usd: null,
      tokens: [],
      error: e.message,
    };
  }

  try {
    const provider = getProvider();
    const balWei = await provider.getBalance(address);
    const native = Number(ethers.formatEther(balWei));

    const tokenRows = [];
    for (const mint of tokens) {
      try {
        const c = new ethers.Contract(mint, erc20Abi, provider);
        const [raw, decimals, symbol] = await Promise.all([
          c.balanceOf(address),
          c.decimals(),
          c.symbol(),
        ]);
        tokenRows.push({
          mint,
          symbol,
          balance: Number(ethers.formatUnits(raw, decimals)),
          decimals: Number(decimals),
        });
      } catch (err) {
        tokenRows.push({ mint, error: err.message });
      }
    }

    return {
      wallet: address,
      chain: chain.id,
      chain_id: chain.chainId,
      dex: config.dex.id,
      native,
      native_symbol: chain.nativeSymbol,
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
      tokens: [],
      error: error.message,
    };
  }
}
