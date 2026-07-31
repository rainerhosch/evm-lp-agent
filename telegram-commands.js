/**
 * Telegram bot command handler — multi-chain ops for evm-lp-agent.
 *
 * Examples:
 *   /balance --chain bsc
 *   /balance --chain all
 *   /positions --chain robinhood
 *   /show-position --chain robinhood
 *   /screen --chain base
 *   /candidates --chain ethereum
 *   /deploy --chain bsc --pool 0x... --amount 0.01
 *   /close 1
 *   /close --chain robinhood --id dry-robinhood-xxx
 *   /chain robinhood
 *   /price --chain bsc --amount 0.015
 *   /manage --chain all
 *   /status --chain all
 */
import { config, isDryRun } from "./config.js";
import {
  parseChainArgs,
  withChain,
  applyChain,
  getActiveChainId,
  listChainIds,
  marketsHelp,
  isValidChain,
  applyDex,
} from "./chain-runtime.js";
import {
  balanceOnChain,
  balanceAllChains,
  positionsAllChains,
  candidatesOnChain,
  priceOnChain,
  formatBalanceLine,
  formatPositionsList,
} from "./tools/multichain.js";
import { executeTool } from "./tools/executor.js";
import { sendMessage, sendHTML, answerCallbackQuery } from "./telegram.js";
import { log } from "./logger.js";

let _busy = false;
const _queue = [];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function reply(html) {
  return sendHTML(html);
}

function replyText(text) {
  return sendMessage(text);
}

export function formatHelpText() {
  const dry = isDryRun() ? "ON" : "OFF";
  return [
    "🤖 <b>evm-lp-agent commands</b>",
    `Active chain: <code>${esc(getActiveChainId())}</code> | DRY_RUN=${dry}`,
    "",
    "<b>Monitoring</b>",
    "/help — this list",
    "/status [--chain all|name] — wallet + positions",
    "/balance [--chain all|name] — native + USD (CoinGecko)",
    "/price [--chain name] [--amount n] — spot USD",
    "/positions | /show-position [--chain all|name]",
    "/pool &lt;n&gt; — detail for list index",
    "/candidates [--chain name] — top pools",
    "/study &lt;pool&gt; [--chain name] — analyze top LPers via Subgraph",
    "/config — runtime config",
    "/markets — chains / DEXes",
    "/chain &lt;name&gt; — switch default active chain",
    "/dex &lt;name&gt; — switch active DEX (e.g. uniswap_v4)",
    "",
    "<b>Actions</b>",
    "/screen [--chain name] — AI screen + deploy",
    "/manage [--chain name|all] — risk exits",
    "/deploy --chain &lt;name&gt; --pool &lt;addr&gt; [--amount n]",
    "/close &lt;n&gt; | /close --id &lt;position_id&gt;",
    "/closeall [--chain name|all]",
    "",
    "<b>Automation</b>",
    "/pause — stop cron screen/manage (e.g. after rate limit)",
    "/resume | /restart — start cron again",
    "/cron — show pause status",
    "",
    "<b>Chains</b>: " + listChainIds().join(", "),
    "",
    "<b>Examples</b>",
    "<code>/balance --chain bsc</code>",
    "<code>/balance --chain all</code>",
    "<code>/show-position --chain robinhood</code>",
    "<code>/screen --chain base</code>",
    "<code>/deploy --chain ethereum --pool 0x… --amount 0.015</code>",
  ].join("\n");
}

function resolveTargetChain(parsed) {
  if (!parsed.chain) return getActiveChainId();
  if (parsed.chain === "all") return "all";
  if (!isValidChain(parsed.chain)) {
    throw new Error(`Unknown chain "${parsed.chain}". Use: ${listChainIds().join(", ")}, all`);
  }
  return parsed.chain;
}

function parseDeployFlags(args) {
  let pool = null;
  let amount = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--pool" || a === "-p") pool = args[++i];
    else if (a?.startsWith("--pool=")) pool = a.split("=")[1];
    else if (a === "--amount" || a === "-a") amount = Number(args[++i]);
    else if (a?.startsWith("--amount=")) amount = Number(a.split("=")[1]);
    else if (!pool && /^0x[a-fA-F0-9]{40}$/.test(a)) pool = a;
    else if (amount == null && Number.isFinite(Number(a)) && !/^0x/.test(a)) amount = Number(a);
  }
  return { pool, amount };
}

function parseCloseId(args) {
  let id = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--id" || a === "--position") id = args[++i];
    else if (a?.startsWith("--id=")) id = a.split("=")[1];
    else if (!id && a && (a.startsWith("dry-") || a.length > 12)) id = a;
  }
  return id;
}

async function cmdBalance(chain) {
  if (chain === "all") {
    const all = await balanceAllChains();
    const lines = all.chains.map(formatBalanceLine);
    return `💰 <b>Balances (all chains)</b>\nTotal ~$${all.total_usd}\n\n${lines.map(esc).join("\n")}`;
  }
  const b = await balanceOnChain(chain);
  return (
    `💰 <b>Balance</b>\n${esc(formatBalanceLine(b))}\n` +
    `Wallet: <code>${esc(b.wallet)}</code>\nDRY_RUN=${isDryRun()}`
  );
}

async function cmdPositions(chain) {
  const data = await positionsAllChains();
  if (chain === "all") {
    return `📊 <b>Positions (all)</b> — ${data.total_positions}\n\n${esc(formatPositionsList(data))}`;
  }
  const filtered = data.positions.filter((p) => p.chain === chain).map((p, i) => ({ ...p, index: i + 1 }));
  return (
    `📊 <b>Positions [${esc(chain)}]</b> — ${filtered.length}\n\n` +
    esc(formatPositionsList({ positions: filtered }, chain))
  );
}

async function cmdPoolDetail(indexOneBased) {
  const data = await positionsAllChains();
  const idx = indexOneBased - 1;
  if (idx < 0 || idx >= data.positions.length) return "Invalid index. Use /positions first.";
  const p = data.positions[idx];
  return [
    `<b>${idx + 1}. ${esc(p.pair)}</b>`,
    `Chain: ${esc(p.chain)} | DEX: ${esc(p.dex)}`,
    `Pool: <code>${esc(p.pool)}</code>`,
    `Position: <code>${esc(p.position)}</code>`,
    `Amount: ${esc(p.amount_native)} ${esc(p.amount_native_symbol || "")}`,
    `Fee: ${esc(p.fee)} | ticks [${esc(p.tick_lower)}, ${esc(p.tick_upper)}]`,
    `Age: ${esc(p.age_minutes)}m | PnL: ${esc(p.pnl_pct)}% | peak: ${esc(p.peak_pnl_pct)}%`,
    p.dry_run ? "🧪 DRY RUN position" : "LIVE",
  ].join("\n");
}

async function cmdCandidates(chain, limit = 8) {
  const top = await candidatesOnChain(chain, limit);
  const lines = (top.candidates || []).map((c, i) => {
    return `${i + 1}. ${esc(c.name)}\n   TVL $${c.tvl_usd} | vol $${c.volume_24h_usd} | APR≈${c.fee_apr_pct}%\n   <code>${esc(c.pool)}</code>`;
  });
  return `🔍 <b>Candidates [${esc(chain)}]</b>\n${lines.join("\n\n") || "none"}`;
}

async function cmdScreen(chain, dex) {
  const { runScreeningCycle } = await import("./index.js");
  return withChain(chain, async () => {
    await reply(`🔍 Screening <b>${esc(config.chain.id)}</b> on <b>${esc(config.dex.name)}</b>…`);
    const report = await runScreeningCycle({ silent: true });
    return `🔍 <b>Screen done</b> [${esc(config.chain.id)}]\n${esc(String(report).slice(0, 3500))}`;
  }, dex);
}

async function cmdManage(chain, dex) {
  const { runManagementCycle } = await import("./index.js");
  if (chain === "all") {
    const results = [];
    for (const id of listChainIds()) {
      const r = await withChain(id, async () => runManagementCycle({ silent: true }), dex);
      results.push(`[${id}] ${r}`);
    }
    return `📋 <b>Manage all</b>\n${esc(results.join("\n"))}`;
  }
  return withChain(chain, async () => {
    const r = await runManagementCycle({ silent: true });
    return `📋 <b>Manage</b> [${esc(chain)}]\n${esc(String(r))}`;
  }, dex);
}

async function cmdDeploy(chain, dex, pool, amount) {
  if (!pool) throw new Error("Usage: /deploy --chain <name> --pool <0x...> [--amount n]");
  return withChain(chain, async () => {
    await reply(`🚀 Deploying on <b>${esc(config.chain.id)}</b> via <b>${esc(config.dex.name)}</b>…`);
    const result = await executeTool("deploy_position", {
      pool_address: pool,
      pool_name: pool,
      amount_native: amount,
    });
    if (result.blocked) return `❌ Blocked: ${esc(result.reason)}`;
    if (result.error) return `❌ ${esc(result.error)}`;
    return (
      `✅ <b>Deploy</b> [${esc(config.chain.id)}]\n` +
      `${result.dry_run ? "🧪 DRY RUN\n" : ""}` +
      `Pair: ${esc(result.pool_name)}\n` +
      `Amount: ${esc(result.amount_native)} ${esc(config.chain.nativeSymbol)}\n` +
      `Position: <code>${esc(result.position_id)}</code>`
    );
  }, dex);
}

async function cmdClose(chain, indexOrId) {
  const data = await positionsAllChains();
  let list = data.positions;
  if (chain && chain !== "all") list = list.filter((p) => p.chain === chain);

  let target = null;
  if (/^\d+$/.test(String(indexOrId))) {
    const idx = parseInt(indexOrId, 10) - 1;
    // index is global from /positions all, or filtered list
    target = (chain && chain !== "all" ? list : data.positions)[idx];
  } else {
    target = data.positions.find(
      (p) => p.position === indexOrId || String(p.position).startsWith(String(indexOrId)),
    );
  }
  if (!target) return "Position not found. Use /positions.";

  return withChain(target.chain, async () => {
    await reply(`Closing <b>${esc(target.pair)}</b> on ${esc(target.chain)}…`);
    const result = await executeTool("close_position", {
      position_id: target.position,
      reason: "telegram /close",
    });
    if (result.error) return `❌ ${esc(result.error)}`;
    return `🔒 Closed ${esc(target.pair)} [${esc(target.chain)}]\n<code>${esc(target.position)}</code>`;
  });
}

async function cmdCloseAll(chain) {
  const { runManagementCycle } = await import("./index.js");
  if (chain === "all") {
    // Note: closeAll across all chains isn't natively one command in multichain,
    // but management cycle will close whatever hits stop loss.
    // If we want a hard close-all, we'd loop. For now, just run manage.
    return `📋 <b>CloseAll all</b>\nNot fully implemented. Use /manage --chain all.`;
  }
  return withChain(chain, async () => {
    return `📋 <b>CloseAll</b> [${esc(chain)}]\nNot fully implemented. Use /manage.`;
  });
}

async function cmdStudy(chain, dex, pool) {
  if (!pool || !pool.startsWith("0x")) {
    return `❌ Usage: /study &lt;pool_address&gt; [--chain name]`;
  }
  return withChain(chain, async () => {
    await reply(`📚 Studying historical data for <b>${esc(pool.slice(0, 6))}...</b> on <b>${esc(config.dex.name)}</b> (${esc(config.chain.name)})...`);
    const { studyTopLPers } = await import("./tools/study.js");
    const data = await studyTopLPers({ pool_address: pool });
    
    let out = `📚 <b>Study</b> [${esc(config.chain.id)}]\n`;
    out += `<i>${esc(data.message)}</i>\n\n`;
    
    if (data.patterns && data.patterns.days_analyzed) {
      out += `<b>Historical Analysis (${data.patterns.days_analyzed}d)</b>\n`;
      out += `📈 Trend: ${data.patterns.overall_trend_pct > 0 ? "+" : ""}${data.patterns.overall_trend_pct}%\n`;
      out += `🌊 Volatility (Daily): ${data.patterns.volatility_daily_pct}%\n`;
      out += `💰 Avg Vol (24h): $${data.patterns.avg_daily_volume.toLocaleString()}\n`;
      out += `📉 Range: $${data.patterns.price_range.low.toExponential(4)} - $${data.patterns.price_range.high.toExponential(4)}\n`;
    }
    return out;
  }, dex);
}

async function cmdStatus(chain) {
  if (chain === "all") {
    const bal = await balanceAllChains();
    const pos = await positionsAllChains();
    return (
      `📟 <b>Status (all)</b>\n` +
      `DRY_RUN=${isDryRun()}\n` +
      `Total USD≈$${bal.total_usd}\n` +
      `Open positions: ${pos.total_positions}\n\n` +
      bal.chains.map(formatBalanceLine).map(esc).join("\n")
    );
  }
  const bal = await balanceOnChain(chain);
  const pos = await positionsAllChains();
  const n = pos.positions.filter((p) => p.chain === chain).length;
  return (
    `📟 <b>Status [${esc(chain)}]</b>\n` +
    `${esc(formatBalanceLine(bal))}\n` +
    `Open positions: ${n}\n` +
    `Default chain: <code>${esc(getActiveChainId())}</code>\n` +
    `DRY_RUN=${isDryRun()}`
  );
}

async function dispatch(rawText) {
  const text = String(rawText || "").trim();
  const parsed = parseChainArgs(text);
  let cmd = (parsed.command || "").replace(/^\//, "").toLowerCase().split("@")[0];
  const args = parsed.args || [];
  const chain = resolveTargetChain(parsed);
  const dex = parsed.dex;

  log("telegram", `cmd=/${cmd} chain=${chain} dex=${dex} args=${JSON.stringify(args)}`);

  switch (cmd) {
    case "help":
    case "start":
      await reply(formatHelpText());
      return;

    case "markets":
      await reply(`🌐 <b>Markets</b>\n${esc(marketsHelp())}`);
      return;

    case "chain":
    case "switch": {
      const target = args[0] || (parsed.chain && parsed.chain !== "all" ? parsed.chain : null);
      if (!target || target === "all") {
        await reply(
          `Active chain: <code>${esc(getActiveChainId())}</code>\n` +
            `Set: /chain ${listChainIds().join("|")}`,
        );
        return;
      }
      const r = applyChain(target);
      await reply(`✅ Active chain → <b>${esc(r.chain.name)}</b> (${esc(r.chain.id)})\nDEX: ${esc(r.dex.name)}`);
      return;
    }

    case "dex": {
      const target = args[0];
      if (!target) {
        await reply(`Active DEX: <code>${esc(config.dex.id)}</code>\nSet: /dex uniswap_v3|uniswap_v4|pancakeswap_v3`);
        return;
      }
      try {
        const r = applyDex(target);
        await reply(`✅ Active DEX → <b>${esc(r.dex.name)}</b> on ${esc(r.chain.name)}`);
      } catch (e) {
        await reply(`❌ ${esc(e.message)}`);
      }
      return;
    }

    case "balance":
    case "wallet":
      await reply(await cmdBalance(chain));
      return;

    case "status":
      await reply(await cmdStatus(chain));
      return;

    case "price": {
      let amount = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--amount") amount = Number(args[++i]);
        else if (args[i]?.startsWith("--amount=")) amount = Number(args[i].split("=")[1]);
        else if (Number.isFinite(Number(args[i]))) amount = Number(args[i]);
      }
      const target = chain === "all" ? getActiveChainId() : chain;
      const px = await priceOnChain(target, amount);
      const extra =
        px.amount_usd != null
          ? `\n${px.amount_native} ${px.symbol} ≈ <b>$${px.amount_usd}</b>`
          : "";
      await reply(
        `💵 <b>Price [${esc(target)}]</b>\n${esc(px.symbol)} = <b>$${esc(px.price_usd)}</b>${extra}`,
      );
      return;
    }

    case "positions":
    case "show-position":
    case "show_position":
    case "pos":
      await reply(await cmdPositions(chain));
      return;

    case "pool":
    case "position": {
      const n = parseInt(args[0], 10);
      if (!Number.isFinite(n)) {
        await reply("Usage: /pool &lt;n&gt;");
        return;
      }
      await reply(await cmdPoolDetail(n));
      return;
    }

    case "candidates":
    case "pools":
      await reply(await cmdCandidates(chain === "all" ? getActiveChainId() : chain));
      return;

    case "screen":
      await reply(await cmdScreen(chain === "all" ? getActiveChainId() : chain, dex));
      return;

    case "manage":
      await reply(await cmdManage(chain, dex));
      return;

    case "deploy": {
      const { pool, amount } = parseDeployFlags(args);
      await reply(await cmdDeploy(chain === "all" ? getActiveChainId() : chain, dex, pool, amount));
      return;
    }

    case "close": {
      const id = parseCloseId(args) || args[0];
      if (!id) {
        await reply("Usage: /close &lt;n&gt; or /close --id &lt;position_id&gt;");
        return;
      }
      await reply(await cmdClose(chain, id));
      return;
    }

    case "closeall":
      await reply(await cmdCloseAll(chain));
      return;

    case "study": {
      const pool = args[0] && args[0].startsWith("0x") ? args[0] : null;
      await reply(await cmdStudy(chain === "all" ? getActiveChainId() : chain, dex, pool));
      return;
    }

    case "config": {
      const c = config;
      await reply(
        [
          `<b>Config</b>`,
          `Active: ${esc(c.chain.id)} / ${esc(c.dex.id)}`,
          `DRY_RUN: ${isDryRun()}`,
          `deploy: ${c.management.deployAmountNative} ${c.chain.nativeSymbol}`,
          `gasReserve: ${c.management.gasReserve}`,
          `maxPositions: ${c.risk.maxPositions}`,
          `stopLoss: ${c.management.stopLossPct}%`,
          `LLM: ${esc(c.llm.screeningModel)}`,
        ].join("\n"),
      );
      return;
    }

    case "ping":
      await reply("pong 🦊");
      return;

    case "pause": {
      const { pauseAutomatedCycles, getAutomationStatus } = await import("./index.js");
      const reason = args.join(" ") || "telegram /pause";
      const r = pauseAutomatedCycles(reason);
      const st = getAutomationStatus();
      await reply(
        `⏸️ <b>Cron paused</b>\n` +
          `Reason: ${esc(r.reason || reason)}\n` +
          `Already paused: ${r.already ? "yes" : "no"}\n` +
          `At: ${esc(st.paused_at || "now")}\n\n` +
          `Manual commands still work.\nUse <code>/resume</code> to restart automation.`,
      );
      return;
    }

    case "resume":
    case "restart": {
      const { resumeAutomatedCycles, getAutomationStatus } = await import("./index.js");
      const r = resumeAutomatedCycles(`telegram /${cmd}`);
      const st = getAutomationStatus();
      await reply(
        `▶️ <b>Cron resumed</b>\n` +
          `Paused before: ${st.paused ? "still paused?!" : "no"}\n` +
          `Tasks: ${st.tasks}\n` +
          `Restarted jobs: ${r.restarted ? "yes" : "no"}\n` +
          (r.previous_reason ? `Was: ${esc(r.previous_reason)}\n` : "") +
          `\nScreen/manage intervals running again.`,
      );
      return;
    }

    case "cron":
    case "automation": {
      const { getAutomationStatus } = await import("./index.js");
      const st = getAutomationStatus();
      await reply(
        `⏱️ <b>Automation</b>\n` +
          `Paused: <b>${st.paused ? "YES" : "no"}</b>\n` +
          (st.reason ? `Reason: ${esc(st.reason)}\n` : "") +
          (st.paused_at ? `Since: ${esc(st.paused_at)}\n` : "") +
          `Cron started: ${st.cron_started}\n` +
          `Tasks: ${st.tasks}\n` +
          `Screen busy: ${st.screen_busy} | Manage busy: ${st.manage_busy}\n\n` +
          (st.paused ? "→ <code>/resume</code>" : "→ <code>/pause</code>"),
      );
      return;
    }

    default:
      if (text.startsWith("/")) {
        await reply(`Unknown command. /help\n<code>${esc(text.slice(0, 80))}</code>`);
      }
  }
}

/**
 * Entry for each Telegram message.
 */
export async function handleTelegramCommand(msg) {
  const text = msg?.text?.trim();
  if (!text) return;

  if (msg?.isCallback && msg.callbackQueryId) {
    await answerCallbackQuery(msg.callbackQueryId, "").catch(() => {});
  }

  if (_busy) {
    if (_queue.length < 8) {
      _queue.push(msg);
      await replyText(`⏳ Queued (${_queue.length}): ${text.slice(0, 40)}`);
    } else {
      await replyText("Queue full. Wait for current command.");
    }
    return;
  }

  _busy = true;
  try {
    await dispatch(text);
  } catch (e) {
    log("telegram_cmd_error", e.message);
    await reply(`❌ ${esc(e.message)}`).catch(() => {});
  } finally {
    _busy = false;
    if (_queue.length) {
      const next = _queue.shift();
      handleTelegramCommand(next).catch(() => {});
    }
  }
}
