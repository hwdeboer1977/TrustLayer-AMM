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
│         │                   ZK Proof: "I'm Tier B"            │          │
│         │                   (score hidden)                    ▼          │
│         │                                             ┌─────────────┐   │
│         │                                             │ Swap with   │   │
│         └────────────────────────────────────────────▶│ 0.3% fee    │   │
│                                                       │ 100K limit  │   │
│                                                       └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tier System

| Tier | Credit Score | Fee | Max Trade | Description |
|------|--------------|-----|-----------|-------------|
| 0 | < 600 | - | No access | Ineligible |
| 1 | 600-699 | 0.5% | 10K tokens | Basic |
| 2 | 700-799 | 0.3% | 100K tokens | Pro |
| 3 | 800+ | 0.1% | 1M tokens | Whale |

## Repository Structure

```
TrustLayer-AMM/
├── trustlayer_credentials/    # Aleo smart contract (Leo)
├── v4_hook/                   # Uniswap V4 Hook (Solidity)
├── backend/                   # Node.js API server
├── frontend/                  # React web UI
└── README.md
```

Each subfolder contains its own detailed README with setup instructions.

## Components

### 1. Aleo Contract (`trustlayer_credentials/`)

Zero-knowledge credential system written in Leo.

- **Issue credentials** with hidden credit scores
- **Prove tier** without revealing actual score
- **On-chain verification** via commitment mappings

```bash
cd trustlayer_credentials
leo run prove_tier <credential> <block>
```

### 2. Uniswap V4 Hook (`v4_hook/`)

Solidity hook enforcing tiered access on swaps.

- **beforeSwap**: Checks tier, enforces limits, sets dynamic fee
- **Relayer pattern**: Only authorized relayer can register traders
- **Configurable tiers**: Admin can adjust fees and limits

```bash
cd v4_hook
forge script script/01_DeployHook.s.sol --rpc-url $ARB_RPC --broadcast --via-ir
```

### 3. Backend (`backend/`)

Node.js server bridging Aleo proofs to Ethereum registration.

- **Verify Aleo proofs** and check credential status
- **Register traders** on Ethereum hook
- **Query tier configs** and trader info

```bash
cd backend
npm install && npm run dev
```

### 4. Frontend (`frontend/`)

React UI for end users.

- **Connect wallet** (MetaMask/Rabby)
- **Register** with Aleo proof TX ID
- **View status** (tier, fees, limits)

```bash
cd frontend
npm install && npm run dev
```

## Quick Start

### Prerequisites

- [Leo](https://developer.aleo.org/leo/) (for Aleo contract)
- [Foundry](https://book.getfoundry.sh/) (for Solidity)
- [Node.js](https://nodejs.org/) 18+ (for backend/frontend)

### 1. Deploy Aleo Contract (Testnet)

```bash
cd trustlayer_credentials
leo deploy --network testnet
```

### 2. Deploy Hook (Arbitrum Sepolia)

```bash
cd v4_hook
cp .env.example .env
# Edit .env with your keys

forge script script/00_DeployMockTokens.s.sol --rpc-url $ARB_RPC --broadcast --via-ir
forge script script/01_DeployHook.s.sol --rpc-url $ARB_RPC --broadcast --via-ir
forge script script/02_CreatePoolAndAddLiquidity.s.sol --rpc-url $ARB_RPC --broadcast --via-ir
```

### 3. Start Backend

```bash
cd backend
cp .env.example .env
# Edit .env with hook address and keys

npm install
npm run dev
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## End-to-End Flow

1. **Issuer** creates credential for user on Aleo
2. **User** calls `prove_tier` on Aleo → gets TX ID
3. **User** connects ETH wallet in frontend
4. **User** enters Aleo TX ID → clicks Register
5. **Backend** verifies proof → registers on ETH hook
6. **User** can now swap on Uniswap with tier benefits

## Documentation

Detailed documentation in each subfolder:

| Folder | README |
|--------|--------|
| `trustlayer_credentials/` | Aleo contract, Leo commands, credential structure |
| `v4_hook/` | Solidity scripts, deployment, hook functions |
| `backend/` | API endpoints, environment config |
| `frontend/` | Components, user flow |

## Tech Stack

- **Aleo/Leo** - Zero-knowledge smart contracts
- **Solidity** - Uniswap V4 Hook
- **Foundry** - Smart contract tooling
- **Node.js/Express** - Backend API
- **React/Vite** - Frontend UI
- **ethers.js** - Ethereum integration

## License

MIT
