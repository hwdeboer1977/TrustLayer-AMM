# TrustLayer Backend

Node.js API server that bridges Aleo ZK credentials with Ethereum/Arbitrum.

## Overview

The backend serves as a relayer between:
- **Aleo**: Verifies ZK proofs and credential status
- **Ethereum/Arbitrum**: Registers traders on TrustLayerHook

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ALEO CHAIN    │     │    BACKEND      │     │   ETH/ARBITRUM  │
│                 │     │                 │     │                 │
│ prove_tier TX   │────▶│ Verify proof    │────▶│ registerTrader  │
│ issued mapping  │◀────│ Check status    │     │ on Hook         │
│ revoked mapping │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Run development server
npm run dev

# Run production
npm start
```

## Environment Variables

```bash
# Server
PORT=3001

# Aleo Configuration
ALEO_ENDPOINT=https://api.explorer.provable.com/v1
ALEO_NETWORK=testnet
ALEO_PROGRAM=trustlayer_credentials_amm_v2.aleo

# Ethereum/Arbitrum Configuration
ARB_RPC=https://sepolia-rollup.arbitrum.io/rpc
PRIVATE_KEY=0xYourRelayerPrivateKey
HOOK_ADDRESS=0xYourDeployedHookAddress
```

**Note:** All three ETH variables (`ARB_RPC`, `PRIVATE_KEY`, `HOOK_ADDRESS`) must be set for Ethereum endpoints to be enabled.

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with config status |

**Response:**
```json
{
  "status": "ok",
  "program": "trustlayer_credentials_amm_v2.aleo",
  "ethEnabled": true
}
```

---

### Aleo Endpoints

#### Get Block Height

```
GET /api/block-height
```

**Response:**
```json
{
  "blockHeight": 13628512
}
```

---

#### Check Issuer

```
GET /api/issuer/:address
```

**Example:**
```bash
curl http://localhost:3001/api/issuer/aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0
```

**Response:**
```json
{
  "address": "aleo1d9es6d8...",
  "isApproved": true
}
```

---

#### Check Credential Issued

```
GET /api/issued/:commitment
```

**Example:**
```bash
curl http://localhost:3001/api/issued/6613525484358723320868794385596564615804189162981013393787560339710562192009field
```

**Response:**
```json
{
  "commitment": "661352548...field",
  "wasIssued": true
}
```

---

#### Check Credential Revoked

```
GET /api/revoked/:commitment
```

**Response:**
```json
{
  "commitment": "661352548...field",
  "isRevoked": false
}
```

---

#### Verify Credential

```
GET /api/verify/:commitment
```

Checks both issued AND revoked status.

**Response:**
```json
{
  "commitment": "661352548...field",
  "wasIssued": true,
  "isRevoked": false,
  "isValid": true
}
```

---

#### Get Transaction Details

```
GET /api/transaction/:txId
```

**Example:**
```bash
curl http://localhost:3001/api/transaction/at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke
```

**Response:**
```json
{
  "txId": "at1yqvv5d7...",
  "tier": 2,
  "commitment": "661352548...field",
  "raw": { ... }
}
```

---

#### Verify Proof Transaction

```
POST /api/verify-proof
```

Verifies a `prove_tier` transaction and checks credential validity.

**Request:**
```json
{
  "txId": "at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke"
}
```

**Response:**
```json
{
  "txId": "at1yqvv5d7...",
  "tier": 2,
  "tierName": "Tier B (Pro)",
  "commitment": "661352548...field",
  "currentBlock": 13500000,
  "wasIssued": true,
  "isRevoked": false,
  "isValid": true,
  "message": "Valid Tier B (Pro) credential"
}
```

---

### Ethereum Endpoints

> **Note:** These endpoints return `503 Service Unavailable` if ETH config is missing.

#### Get Hook Info

```
GET /api/eth/hook-info
```

**Response:**
```json
{
  "hookAddress": "0x...",
  "admin": "0x...",
  "relayer": "0x...",
  "relayerConfigured": "0x..."
}
```

---

#### Get Trader Info

```
GET /api/eth/trader/:address
```

**Example:**
```bash
curl http://localhost:3001/api/eth/trader/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**Response:**
```json
{
  "address": "0xf39Fd6e51...",
  "tier": 2,
  "tierName": "Tier B (Pro)",
  "registeredAt": 9995796,
  "expiry": 10095796,
  "commitment": "0x00000000000000000000000000000000000000000000000000000000000030d5",
  "isRegistered": true
}
```

---

#### Get Tier Config

```
GET /api/eth/tier/:tier
```

**Example:**
```bash
curl http://localhost:3001/api/eth/tier/2
```

**Response:**
```json
{
  "tier": 2,
  "feeBps": 3000,
  "feePercent": 0.3,
  "maxTradeSize": "100000000000000000000000",
  "maxTradeSizeFormatted": "100000.0",
  "enabled": true
}
```

---

#### Check Can Swap

```
GET /api/eth/can-swap/:address/:amount
```

**Example:**
```bash
curl http://localhost:3001/api/eth/can-swap/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/10000
```

**Response:**
```json
{
  "address": "0xf39Fd6e51...",
  "amount": "10000",
  "amountWei": "10000000000000000000000",
  "canSwap": true,
  "reason": "OK"
}
```

---

#### Register Trader

```
POST /api/eth/register-trader
```

Main endpoint - verifies Aleo proof then registers on Ethereum.

**Request:**
```json
{
  "aleoTxId": "at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke",
  "ethAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "expiryBlocks": 100000
}
```

**Process:**
1. Fetch Aleo transaction
2. Extract tier and commitment from `prove_tier` outputs
3. Verify credential is issued (not revoked) on Aleo
4. Call `registerTrader()` on Ethereum hook
5. Return transaction receipt

**Response:**
```json
{
  "success": true,
  "message": "Successfully registered Tier B (Pro) trader",
  "aleoTxId": "at1yqvv5d7...",
  "ethTxHash": "0x...",
  "trader": "0xf39Fd6e51...",
  "tier": 2,
  "tierName": "Tier B (Pro)",
  "commitment": "0x...",
  "expiry": 10095796,
  "blockNumber": 9995796
}
```

**Errors:**
- `400` - Aleo transaction not found
- `400` - Could not extract tier/commitment
- `400` - Tier 0 (Ineligible) cannot be registered
- `400` - Credential was not issued on Aleo
- `400` - Credential has been revoked on Aleo
- `503` - Ethereum not configured

---

#### Revoke Trader

```
POST /api/eth/revoke-trader
```

**Request:**
```json
{
  "ethAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "aleoCommitment": "661352548...field"  // Optional: verify Aleo revocation first
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trader revoked successfully",
  "ethTxHash": "0x...",
  "trader": "0xf39Fd6e51...",
  "blockNumber": 9995800
}
```

---

## Tier System

| Tier | Name | Score Range | Fee | Max Trade |
|------|------|-------------|-----|-----------|
| 0 | Unregistered | - | - | No access |
| 1 | Basic | 600-699 | 0.5% | 10K tokens |
| 2 | Pro | 700-799 | 0.3% | 100K tokens |
| 3 | Whale | 800+ | 0.1% | 1M tokens |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "ethers": "^6.9.0"
}
```

---

## Development

```bash
# Install
npm install

# Run with auto-reload
npm run dev

# Run production
npm start
```

**package.json scripts:**
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## Error Handling

All endpoints return JSON errors:

```json
{
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (missing params, invalid data)
- `404` - Not found (transaction, trader)
- `500` - Server error
- `503` - Service unavailable (ETH not configured)

---

## Security Notes

1. **Private Key**: The `PRIVATE_KEY` should be for a dedicated relayer wallet, not your main wallet
2. **Rate Limiting**: Consider adding rate limiting for production
3. **CORS**: Currently allows all origins - restrict for production
4. **Validation**: Add input validation for addresses and amounts

---

## License

MIT
