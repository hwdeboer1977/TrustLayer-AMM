# TrustLayer Hook

Uniswap V4 Hook with tiered trading access based on zero-knowledge credentials.

## Overview

TrustLayerHook enforces tiered trading on Uniswap V4:
- **Tier 1 (Basic)**: 0.5% fee, max 10K tokens
- **Tier 2 (Pro)**: 0.3% fee, max 100K tokens  
- **Tier 3 (Whale)**: 0.1% fee, max 1M tokens
- **Unregistered**: No access

## Project Structure

```
├── src/
│   ├── TrustLayerHook.sol    # Main hook contract
│   ├── MockUSDC.sol          # Test token (6 decimals)
│   └── MockUSDT.sol          # Test token (6 decimals)
├── script/
│   ├── base/
│   │   ├── BaseScript.sol    # Shared addresses & config
│   │   └── LiquidityHelpers.sol
│   ├── 00_DeployMockTokens.s.sol
│   ├── 01_DeployHook.s.sol
│   ├── 02_CreatePoolAndAddLiquidity.s.sol
│   ├── 03_MintPositionToEOA.s.sol
│   ├── 04_RegisterTrader.s.sol
│   ├── Check_status.s.sol
│   ├── Check_liquidity.s.sol
│   └── Swap.s.sol
└── test/
```

## Environment Setup

### `.env.anvil` (Local Testing)

```bash
# Wallet
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
WALLET_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Roles
OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RELAYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
TRADER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Tokens (set after 00_DeployMockTokens)
TOKEN0_ADDRESS=
TOKEN1_ADDRESS=

# Hook (set after 01_DeployHook)
HOOK_ADDRESS=

# Pool (set after 02_CreatePoolAndAddLiquidity)
TOKEN_ID=
POOL_ID=

# Liquidity amounts
AMOUNT0=1000000000    # 1,000 tokens (6 decimals)
AMOUNT1=1000000000    # 1,000 tokens (6 decimals)
```

### `.env` (Arbitrum Sepolia)

```bash
# Wallet
PRIVATE_KEY=0xYourPrivateKey
WALLET_ADDRESS=0xYourAddress

# Roles
OWNER=0xYourAddress
RELAYER=0xYourAddress
TRADER_ADDRESS=0xYourAddress

# RPC
ARB_RPC=https://sepolia-rollup.arbitrum.io/rpc

# Tokens & Hook (set after deployment)
TOKEN0_ADDRESS=
TOKEN1_ADDRESS=
HOOK_ADDRESS=
TOKEN_ID=
```

## Scripts

### 00_DeployMockTokens.s.sol

Deploys MockUSDC and MockUSDT test tokens.

```bash
# Anvil
forge script script/00_DeployMockTokens.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

# Arbitrum Sepolia
forge script script/00_DeployMockTokens.s.sol --rpc-url $ARB_RPC --broadcast -vvvv --via-ir
```

**Output:** Token addresses → Update `TOKEN0_ADDRESS` and `TOKEN1_ADDRESS` in `.env`

**Important:** Also update `token0` and `token1` in `BaseScript.sol`

---

### 01_DeployHook.s.sol

Deploys TrustLayerHook with CREATE2 address mining for correct hook flags.

```bash
# Anvil
forge script script/01_DeployHook.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

# Arbitrum Sepolia
forge script script/01_DeployHook.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
```

**Output:** Hook address → Update `HOOK_ADDRESS` in `.env` and `BaseScript.sol`

---

### 02_CreatePoolAndAddLiquidity.s.sol

Creates a new pool and adds initial liquidity in a single transaction.

```bash
# Anvil
forge script script/02_CreatePoolAndAddLiquidity.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

# Arbitrum Sepolia
forge script script/02_CreatePoolAndAddLiquidity.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
```

**Env Variables:**
- `AMOUNT0`: Token0 amount (default: from .env)
- `AMOUNT1`: Token1 amount (default: from .env)
- `START_PRICE_NUM` / `START_PRICE_DEN`: Initial price ratio (default: 1/1)
- `TICK_SPACING`: Pool tick spacing (default: 60)

**Output:** Token ID → Update `TOKEN_ID` in `.env`

---

### 03_MintPositionToEOA.s.sol

Mints additional full-range liquidity position to your wallet.

```bash
# Anvil
forge script script/03_MintPositionToEOA.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

# Arbitrum Sepolia
forge script script/03_MintPositionToEOA.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
```

**Env Variables:**
- `AMOUNT0`: Token0 amount (default: 1000e6)
- `AMOUNT1`: Token1 amount (default: 1000e6)

---

### 04_RegisterTrader.s.sol

Registers a trader address with a tier (must be called by relayer).

```bash
# Anvil
forge script script/04_RegisterTrader.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir
```

**Env Variables:**
- `HOOK_ADDRESS`: Deployed hook address
- `TRADER_ADDRESS`: Address to register

**Default:** Registers as Tier 2 (Pro) with 1,000,000 block expiry

---

### Swap.s.sol

Executes a token swap through the hook.

```bash
# Anvil
forge script script/Swap.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

# Arbitrum Sepolia
forge script script/Swap.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
```

**Env Variables:**
- `AMOUNT_IN`: Swap amount (default: 100e6)
- `ZERO_FOR_ONE`: Swap direction (default: true = token0→token1)

**Note:** Trader must be registered or swap will revert with `TraderNotRegistered()`

---

### Check_status.s.sol

View hook configuration and trader status (read-only, no gas).

```bash
# Anvil
forge script script/Check_status.s.sol --rpc-url http://127.0.0.1:8545 -vvvv --via-ir
```

**Output:**
- Hook admin and relayer addresses
- All tier configurations (fee, max trade size, enabled)
- Trader info (tier, registration block, expiry, commitment)
- Can-swap checks for various amounts
- Fee preview

---

### Check_liquidity.s.sol

View pool and position liquidity details (read-only).

```bash
# Anvil
forge script script/Check_liquidity.s.sol --rpc-url http://127.0.0.1:8545 -vvvv --via-ir

# Arbitrum Sepolia
forge script script/Check_liquidity.s.sol --rpc-url $ARB_RPC -vvvv --via-ir
```

**Env Variables:**
- `TOKEN_ID`: Position token ID to check

**Output:**
- Pool state (sqrtPriceX96, current tick)
- Position info (liquidity, fee growth)
- Principal amounts at current price

---

## Deployment Workflow

### Local (Anvil)

```bash
# 1. Start Anvil
anvil

# 2. Load environment
set -a; source .env.anvil; set +a

# 3. Deploy tokens
forge script script/00_DeployMockTokens.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir
# → Update TOKEN0_ADDRESS, TOKEN1_ADDRESS in .env.anvil and BaseScript.sol

# 4. Deploy hook
forge script script/01_DeployHook.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir
# → Update HOOK_ADDRESS in .env.anvil and BaseScript.sol

# 5. Create pool + liquidity
forge script script/02_CreatePoolAndAddLiquidity.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir
# → Update TOKEN_ID in .env.anvil

# 6. Register trader
forge script script/04_RegisterTrader.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir

# 7. Swap
forge script script/Swap.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -vvvv --via-ir
```

### Arbitrum Sepolia

```bash
# 1. Load environment
set -a; source .env; set +a

# 2. Deploy (same scripts, different RPC)
forge script script/00_DeployMockTokens.s.sol --rpc-url $ARB_RPC --broadcast -vvvv --via-ir
forge script script/01_DeployHook.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
forge script script/02_CreatePoolAndAddLiquidity.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
forge script script/04_RegisterTrader.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
forge script script/Swap.s.sol --rpc-url $ARB_RPC --broadcast -vv --via-ir
```

---

## Contract Reference

### TrustLayerHook.sol

**Hook Permissions:**
- `beforeInitialize`: Enforces dynamic fee flag
- `beforeSwap`: Checks tier, enforces limits, sets fee

**Key Functions:**

| Function | Access | Description |
|----------|--------|-------------|
| `registerTrader(address, uint8, bytes32, uint256)` | Relayer | Register trader with tier |
| `revokeTrader(address)` | Relayer | Remove trader access |
| `batchRegisterTraders(...)` | Relayer | Register multiple traders |
| `setTierConfig(uint8, uint24, uint256, bool)` | Admin | Update tier settings |
| `setRelayer(address)` | Admin | Change relayer address |
| `setAdmin(address)` | Admin | Transfer admin role |
| `getTraderInfo(address)` | Public | Get trader tier & status |
| `getTierConfig(uint8)` | Public | Get tier configuration |
| `canSwap(address, uint256)` | Public | Check if swap allowed |
| `previewFee(address)` | Public | Get fee for trader |

**Error Codes:**

| Error | Cause |
|-------|-------|
| `TraderNotRegistered()` | Trader has tier 0 |
| `TierNotEnabled()` | Tier disabled by admin |
| `CredentialExpired()` | Block number > expiry |
| `TradeTooLarge(req, max)` | Trade exceeds tier limit |
| `NotRelayer()` | Caller is not relayer |
| `NotAdmin()` | Caller is not admin |
| `MustUseDynamicFee()` | Pool missing dynamic fee flag |

---

## License

MIT
