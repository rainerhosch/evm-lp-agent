/** OpenAI tool schemas for the EVM LP agent. */
export const tools = [
  {
    type: "function",
    function: {
      name: "get_wallet_balance",
      description: "Native balance and chain info for the configured EVM wallet",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_candidates",
      description: "Top Uniswap V3 / Pancake V3 style pools on the active chain",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pool_detail",
      description: "Detail for one pool address",
      parameters: {
        type: "object",
        properties: { pool_address: { type: "string" } },
        required: ["pool_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_positions",
      description: "Open LP positions tracked by this agent",
      parameters: { type: "object", properties: { force: { type: "boolean" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "deploy_position",
      description:
        "Open a concentrated-liquidity position (Uniswap V3 / Pancake V3). Dry-run safe. amount_native is ETH or BNB.",
      parameters: {
        type: "object",
        properties: {
          pool_address: { type: "string" },
          pool_name: { type: "string" },
          amount_native: { type: "number" },
          fee: { type: "number", description: "Fee tier e.g. 500, 3000, 10000" },
          tick_range_width: { type: "number" },
        },
        required: ["pool_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_position",
      description: "Close an LP position by position_id",
      parameters: {
        type: "object",
        properties: {
          position_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["position_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "claim_fees",
      description: "Claim uncollected fees for a position",
      parameters: {
        type: "object",
        properties: { position_id: { type: "string" } },
        required: ["position_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_config",
      description: "Active chain, dex, risk and management config",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "compute_deploy_amount",
      description: "Compute sized deploy from wallet native balance (includes USD via CoinGecko)",
      parameters: {
        type: "object",
        properties: { native_balance: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_native_price",
      description: "Realtime native gas token USD price from CoinGecko (ETH or BNB for active chain)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_native_usd",
      description: "Convert native↔USD using live CoinGecko price. Pass amount_native OR amount_usd.",
      parameters: {
        type: "object",
        properties: {
          amount_native: { type: "number" },
          amount_usd: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chart_indicators",
      description: "Evaluate technical analysis chart indicators (RSI, Bollinger Bands) for a pool",
      parameters: {
        type: "object",
        properties: {
          pool_address: { type: "string" },
          side: { type: "string", enum: ["entry", "exit"] },
        },
        required: ["pool_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pool_memory",
      description: "Retrieve past deployment history and notes for a pool",
      parameters: {
        type: "object",
        properties: {
          pool_address: { type: "string" },
        },
        required: ["pool_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_performance_history",
      description: "Get recent closed position history to evaluate agent performance",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
];
