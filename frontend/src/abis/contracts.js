// TrustLayerHook ABI - the functions we interact with from the frontend
export const HOOK_ABI = [
  "function registerTrader(address trader, uint8 tier, bytes32 commitment, uint256 expiry) external",
  "function revokeTrader(address trader) external",
  "function getTraderInfo(address trader) external view returns (tuple(uint8 tier, uint256 registeredAt, uint256 expiry, bytes32 commitment))",
  "function getTierConfig(uint8 tier) external view returns (tuple(uint24 feeBps, uint256 maxTradeSize, bool enabled))",
  "function canSwap(address trader, uint256 tradeSize) external view returns (bool, string memory)",
  "function previewFee(address trader) external view returns (uint24)",
  "function admin() external view returns (address)",
  "function relayer() external view returns (address)"
];

// ERC20 ABI - for token approvals and balance checks
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Uniswap V4 PoolSwapTest (test router used on testnets for swapping through hooks)
// This is the standard test contract deployed alongside V4 core
export const SWAP_ROUTER_ABI = [
  "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, tuple(bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) external payable returns (int256)",
];

// PoolManager ABI - for reading pool state
export const POOL_MANAGER_ABI = [
  "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
];

// Contract addresses - UPDATE THESE after deployment
export const ADDRESSES = {
  // Arbitrum Sepolia addresses (update after deploying)
  HOOK: import.meta.env.VITE_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000",
  SWAP_ROUTER: import.meta.env.VITE_SWAP_ROUTER_ADDRESS || "0x0000000000000000000000000000000000000000",
  POOL_MANAGER: import.meta.env.VITE_POOL_MANAGER_ADDRESS || "0x0000000000000000000000000000000000000000",
  TOKEN_A: import.meta.env.VITE_TOKEN_A_ADDRESS || "0x0000000000000000000000000000000000000000",
  TOKEN_B: import.meta.env.VITE_TOKEN_B_ADDRESS || "0x0000000000000000000000000000000000000000",
};

// Chain config
export const CHAIN_CONFIG = {
  chainId: 421614, // Arbitrum Sepolia
  chainName: "Arbitrum Sepolia",
  rpcUrl: import.meta.env.VITE_ARB_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
  explorer: "https://sepolia.arbiscan.io",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
};

// Tier metadata
export const TIER_INFO = {
  0: { name: "Unregistered", label: "No Access", color: "#6b7280", fee: "-", maxTrade: "-" },
  1: { name: "Tier C", label: "Basic", color: "#f59e0b", fee: "0.5%", maxTrade: "10K" },
  2: { name: "Tier B", label: "Pro", color: "#3b82f6", fee: "0.3%", maxTrade: "100K" },
  3: { name: "Tier A", label: "Whale", color: "#10b981", fee: "0.1%", maxTrade: "1M" },
};
