# TrustLayer Credentials - Backend API

Simple Node.js API for querying TrustLayer Credentials on Aleo.

## Setup

```bash
cd backend
npm install
```

## Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3001`

## API Endpoints

### Health Check
```
GET /health
```

### Get Block Height
```
GET /api/block-height
```

Response:
```json
{ "blockHeight": 13610909 }
```

### Check Issuer
```
GET /api/issuer/:address
```

Example:
```bash
curl http://localhost:3001/api/issuer/aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0
```

Response:
```json
{
  "address": "aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0",
  "isApproved": true
}
```

### Check Issued
```
GET /api/issued/:commitment
```

### Check Revoked
```
GET /api/revoked/:commitment
```

### Verify Credential (issued AND not revoked)
```
GET /api/verify/:commitment
```

Example:
```bash
curl http://localhost:3001/api/verify/6613525484358723320868794385596564615804189162981013393787560339710562192009field
```

Response:
```json
{
  "commitment": "6613525484358723320868794385596564615804189162981013393787560339710562192009field",
  "wasIssued": true,
  "isRevoked": false,
  "isValid": true
}
```

### Get Transaction
```
GET /api/transaction/:txId
```

### Verify Proof (Main Endpoint)
```
POST /api/verify-proof
Content-Type: application/json

{ "txId": "at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke" }
```

Response:
```json
{
  "txId": "at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke",
  "tier": 2,
  "tierName": "Tier B (Pro)",
  "commitment": "6613525484358723320868794385596564615804189162981013393787560339710562192009field",
  "currentBlock": 500,
  "wasIssued": true,
  "isRevoked": false,
  "isValid": true,
  "message": "Valid Tier B (Pro) credential"
}
```

## Test with curl

```bash
# Health check
curl http://localhost:3001/health

# Block height
curl http://localhost:3001/api/block-height

# Verify a proof transaction
curl -X POST http://localhost:3001/api/verify-proof \
  -H "Content-Type: application/json" \
  -d '{"txId": "at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke"}'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `ALEO_ENDPOINT` | https://api.explorer.provable.com/v1 | Aleo API endpoint |
| `ALEO_NETWORK` | testnet | Network (testnet/mainnet) |
| `ALEO_PROGRAM` | trustlayer_credentials_amm_v2.aleo | Program name |
