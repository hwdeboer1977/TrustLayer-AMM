# TrustLayer AMM

A ZK Credit-Score-Weighted AMM combining Aleo privacy with Uniswap V4 hooks.

## Overview

TrustLayer enables tiered trading access on Uniswap V4 based on zero-knowledge credit score proofs from Aleo. Users prove their creditworthiness without revealing their actual score, and receive preferential fees and higher trading limits.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRUSTLAYER FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ALEO (Privacy)              BACKEND (Bridge)           ETH (Trading)   │
│  ┌─────────────┐            ┌─────────────┐           ┌─────────────┐   │
│  │ Issue cred  │            │             │           │             │   │
│  │ prove_tier  │───────────▶│ Verify proof│──────────▶│ Register    │   │
│  │             │            │ Check status│           │ trader      │   │
│  └─────────────┘            └─────────────┘           └─────────────┘   │
│         │                                                     │          │
│         │                   ZK Proof: "I'm Tier 3"            │          │
│         │                   (score hidden)                    ▼          │
│         │                                             ┌─────────────┐   │
│         │                                             │ Swap with   │   │
│         └────────────────────────────────────────────▶│ 0.1% fee    │   │
│                                                       │ 1M limit    │   │
│                                                       └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tier System

| Tier | Credit Score | Fee | Max Trade | Description |
|------|--------------|-----|-----------|-------------|
| 0 | < 600 | — | No access | Ineligible |
| 1 | 600–699 | 0.5% | 10K tokens | Basic |
| 2 | 700–799 | 0.3% | 100K tokens | Pro |
| 3 | 800+ | 0.1% | 1M tokens | Whale |

## Deployed Contracts

### Aleo (Testnet)

| Component | Address / ID |
|-----------|-------------|
| Program | `trustlayer_credentials_amm_v2.aleo` |
| Admin Address | `aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0` |

### Arbitrum Sepolia

| Component | Address |
|-----------|---------|
| TrustLayerHook | `0x6FA943aB75B89918168331f5ca959278bA01a080` |
| Swap Router | `0xcD8D7e10A7aA794C389d56A07d85d63E28780220` |
| PoolManager | `0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317` |
| PositionManager | `0xAc631556d3d4019C95769033B5E719dD77124BAc` |
| Token A (TLA) | `0xF2d7093Cad5E94837C48b5acE14090d380fDCecf` (6 decimals) |
| Token B (TLB) | `0xaf803e816583670debDecDa20305F09e4Ad0fC72` (6 decimals) |

## Repository Structure

```
TrustLayer-AMM/
├── trustlayer_credentials/    # Aleo smart contract (Leo)
├── v4_hook/                   # Uniswap V4 Hook (Solidity)
├── backend/                   # Node.js API server
├── frontend/                  # React web UI
└── README.md
```

## End-to-End Flow

### Step 1: Issue Credential (Admin)

An authorized issuer creates a private credential for a user on Aleo. The credit score is stored privately — only the resulting tier can be proven publicly.

1. Go to **Admin** tab → **Issue Credential**
2. Enter recipient Aleo address, credit score (0–1000), expiry block, and nonce
3. Click **Issue Credential**
4. Backend executes `trustlayer_credentials_amm_v2.aleo :: issue()` via `snarkos`
5. A private `Credential` record is created on-chain, encrypted for the recipient
6. Save the **Transaction ID**

### Step 2: Prove Tier (User)

The user generates a zero-knowledge proof of their tier without revealing their score.

1. Go to **Prove Tier** tab
2. Paste the Issue TX ID → click **Fetch & Decrypt**
3. Backend fetches the transaction, decrypts the credential record using the view key
4. Click **Prove My Tier**
5. Backend executes `prove_tier()` via `snarkos` (ZK proof generation takes 1–3 min)
6. Result: a public tier output (e.g. `3u8`) with the score remaining hidden
7. Copy the **prove_tier TX ID**

### Step 3: Register ETH Wallet (User)

Link the verified Aleo tier to an Ethereum wallet for trading access.

1. Go to **Register** tab
2. Connect MetaMask wallet — ETH address auto-fills
3. Paste the prove_tier TX ID, set expiry blocks
4. Click **Register My Wallet**
5. Backend verifies the proof on Aleo, then calls `registerTrader()` on the V4 hook
6. ETH wallet is now mapped to tier with fee and limit configuration

### Step 4: Swap with Tier Fees (User)

Trade on Uniswap V4 with tier-specific fees and limits.

1. Go to **Swap** tab — tier banner shows your fee rate and max trade size
2. Select tokens and amount
3. Approve tokens (first swap only)
4. Click **Swap**
5. The V4 hook's `beforeSwap` checks registration, enforces limits, and applies dynamic fees

## Components

### 1. Aleo Contract (`trustlayer_credentials/`)

Zero-knowledge credential system written in Leo.

- **issue()** — Create private credential with hidden credit score
- **prove_tier()** — Generate ZK proof of tier (public output) without revealing score
- **revoke()** — Invalidate a credential by commitment
- **add_issuer() / remove_issuer()** — Manage authorized issuers

```bash
cd trustlayer_credentials
leo run prove_tier <credential> <block>
```

### 2. Uniswap V4 Hook (`v4_hook/`)

Solidity hook enforcing tiered access on swaps.

- **beforeSwap**: Checks tier, enforces trade size limits, returns dynamic fee
- **beforeInitialize**: Validates pool configuration
- **Relayer pattern**: Only authorized relayer can register traders
- **Configurable tiers**: Admin can adjust fees, limits, and enable/disable tiers

```bash
cd v4_hook
forge script script/01_DeployHook.s.sol --rpc-url $ARB_RPC --broadcast --via-ir
```

### 3. Backend (`backend/`)

Node.js/Express server bridging Aleo proofs to Ethereum registration.

- **POST /api/aleo/issue-credential** — Issue credential via snarkos CLI
- **POST /api/aleo/prove-tier** — Execute prove_tier and broadcast ZK proof
- **POST /api/aleo/fetch-credential** — Fetch TX and decrypt credential record
- **POST /api/aleo/decrypt-record** — Decrypt a record ciphertext with view key
- **POST /api/verify-proof** — Verify Aleo proof and register trader on ETH hook
- **GET /api/trader/:address** — Query trader tier info from hook
- **POST /api/aleo/add-issuer** — Add approved issuer (admin only)
- **POST /api/aleo/revoke-credential** — Revoke credential on Aleo

```bash
cd backend
npm install && npm run dev
```

### 4. Frontend (`frontend/`)

React/Vite UI with dual wallet support (Leo Wallet for Aleo + MetaMask for ETH).

**Tabs:**
- **Swap** — Uniswap V4 swap interface with tier status banner
- **My Status** — View current tier, registration, and credential info
- **Prove Tier** — Fetch credential from TX, generate ZK proof via backend
- **Register** — Link Aleo proof to ETH wallet
- **Verify Proof** — Check any Aleo proof TX
- **Admin** — Issue credentials, manage issuers, revoke, hook config

```bash
cd frontend
npm install && npm run dev
```

Open http://localhost:3000

## Quick Start

### Prerequisites

- [Leo / snarkOS](https://developer.aleo.org/leo/) — Aleo CLI tools
- [Foundry](https://book.getfoundry.sh/) — Solidity tooling (forge, cast)
- [Node.js](https://nodejs.org/) 18+ — Backend and frontend
- [Leo Wallet](https://www.leo.app/) — Browser extension for Aleo
- [MetaMask](https://metamask.io/) — Browser extension for ETH

### 1. Deploy Aleo Contract (Testnet)

```bash
cd trustlayer_credentials
leo deploy --network testnet
```

### 2. Deploy Hook & Pool (Arbitrum Sepolia)

```bash
cd v4_hook
cp .env.example .env
# Edit .env with your keys and addresses

# Deploy mock tokens
forge script script/00_DeployMockTokens.s.sol --rpc-url $ARB_RPC --broadcast --via-ir

# Deploy hook (mines CREATE2 salt for correct hook flags)
forge script script/01_DeployHook.s.sol --rpc-url $ARB_RPC --broadcast --via-ir

# Create pool and initialize
forge script script/02_CreatePoolAndAddLiquidity.s.sol --rpc-url $ARB_RPC --broadcast --via-ir

# Mint tokens to deployer and add full-range liquidity
cast send $TOKEN0 "mint(address,uint256)" $DEPLOYER 10000000000 --private-key $PK --rpc-url $ARB_RPC
cast send $TOKEN1 "mint(address,uint256)" $DEPLOYER 10000000000 --private-key $PK --rpc-url $ARB_RPC
export AMOUNT0=10000000000 AMOUNT1=10000000000
forge script script/03_MintPositionToEOA.s.sol:MintFullRangePosition --rpc-url $ARB_RPC --broadcast --via-ir
```

### 3. Start Backend

```bash
cd backend
cp .env.example .env
# Edit .env:
#   ALEO_PRIVATE_KEY=APrivateKey1...
#   ALEO_VIEW_KEY=AViewKey1...
#   HOOK_ADDRESS=0x...
#   PRIVATE_KEY=0x... (ETH relayer key)

npm install
npm run dev
```

### 4. Start Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env:
#   VITE_HOOK_ADDRESS=0x...
#   VITE_SWAP_ROUTER_ADDRESS=0x...
#   VITE_TOKEN_A_ADDRESS=0x...
#   VITE_TOKEN_B_ADDRESS=0x...

npm install
npm run dev
```

Open http://localhost:3000

## Privacy Guarantees

- **Credit score is never revealed** — only the tier (1/2/3) is public
- **Credential records are encrypted** — only the owner can decrypt with their view key
- **ZK proof is trustless** — the `prove_tier` transition mathematically proves the tier threshold without exposing the score
- **On-chain verifiability** — anyone can verify the proof TX on Aleo but cannot learn the score
- **Cross-chain privacy** — the ETH hook only knows the tier, not the Aleo score or identity

## Tech Stack

- **Aleo / Leo** — Zero-knowledge smart contracts
- **Solidity** — Uniswap V4 Hook (TrustLayerHook.sol)
- **Foundry** — Smart contract compilation, testing, deployment
- **Node.js / Express** — Backend API bridge
- **React / Vite** — Frontend UI
- **ethers.js v6** — Ethereum wallet and contract interaction
- **Leo Wallet Adapter** — Aleo wallet integration
- **snarkos CLI** — Aleo transaction execution and record decryption

## License

MIT
