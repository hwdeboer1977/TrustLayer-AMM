# TrustLayer Credentials - Aleo ZK Credential System

A privacy-preserving credential system for tiered AMM access using zero-knowledge proofs on the Aleo blockchain.

## Overview

TrustLayer Credentials enables traders to prove their eligibility tier for AMM access **without revealing their underlying credit score**. Built on Aleo's zero-knowledge architecture, it ensures complete privacy while providing cryptographic proof of eligibility.

### Key Features

- 🔐 **Zero-Knowledge Proofs**: Prove tier eligibility without exposing credit score
- ⛓️ **On-Chain Registry**: Commitments stored on-chain for verification
- 🚫 **Revocation Support**: Admin can revoke credentials instantly
- 🔑 **Admin Controls**: Only approved issuers can create credentials
- 🎯 **Privacy-First**: Only tier (1/2/3) is revealed, never the score

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ALEO BLOCKCHAIN                          │
│                                                              │
│  Private (in user's record):                                 │
│  ├── score: 750                                              │
│  ├── expiry: 50000000                                        │
│  ├── issuer: aleo1...                                        │
│  └── nonce: 12345field                                       │
│                                                              │
│  Public (on-chain mappings):                                 │
│  ├── issued: hash(nonce) → true                              │
│  ├── revoked: hash(nonce) → true/false                       │
│  └── approved_issuers: address → true/false                  │
│                                                              │
│  Proof Output (revealed):                                    │
│  └── tier: 2u8  (only this is visible!)                      │
└─────────────────────────────────────────────────────────────┘
```

## Tier System

| Score Range | Tier | Name | Use Case |
|-------------|------|------|----------|
| < 600 | 0 | Ineligible | No access |
| 600 - 699 | 1 | Tier C (Basic) | Small trades |
| 700 - 799 | 2 | Tier B (Pro) | Medium trades |
| 800+ | 3 | Tier A (Whale) | Large trades |

## Testing Options

| Method | Network | State Persistence | Use Case |
|--------|---------|-------------------|----------|
| `leo run` | None (local) | ❌ No | Quick logic testing |
| `leo execute --endpoint localhost` | Local devnet | ✅ Yes | Full testing with mappings |
| `make` commands | Public testnet | ✅ Yes | Production testing |

---

## Option 1: Public Testnet (Recommended)

Use the Makefile for all testnet operations. Requires testnet credits from [faucet.aleo.org](https://faucet.aleo.org).

### Setup

```bash
# 1. Get testnet credits from https://faucet.aleo.org

# 2. Configure .env
NETWORK=testnet
PRIVATE_KEY=APrivateKey1zkp...
ENDPOINT=https://api.explorer.provable.com/v1
```

### Makefile Commands

```bash
# Build the program
make build

# Deploy to testnet
make deploy

# Add yourself as approved issuer (first time setup)
make setup

# Issue a credential
make issue RECIPIENT=aleo1... SCORE=750 EXPIRY=50000000 NONCE=12345

# Prove tier with credential (single line!)
make prove CRED="{owner: aleo1..., score: 750u16.private, ...}" BLOCK=500

# Revoke a credential
make revoke COMMITMENT=123...field

# Query on-chain mappings
make query-issuer ADDR=aleo1...
make query-issued COMMITMENT=123...field
make query-revoked COMMITMENT=123...field
```

### Full Testnet Flow

```bash
# 1. Setup (one time) - adds yourself as approved issuer
make setup

# 2. Issue credential to yourself (score 750 = Tier B)
make issue RECIPIENT=aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0 SCORE=750 EXPIRY=50000000 NONCE=12345

# 3. Save the credential record from output!
# Example output:
# {
#   owner: aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0.private,
#   score: 750u16.private,
#   expiry: 50000000u32.private,
#   issuer: aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0.private,
#   nonce: 12345field.private,
#   _nonce: 6644200927086711974273859474179569160479435004059909891962670620328201451334group.public,
#   _version: 1u8.public
# }

# 4. Prove tier (put credential on SINGLE LINE)
make prove CRED="{owner: aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0.private,
  score: 750u16.private,
  expiry: 50000000u32.private,
  issuer: aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0.private,
  nonce: 12345field.private,
  _nonce: 6644200927086711974273859474179569160479435004059909891962670620328201451334group.public,
  _version: 1u8.public}" BLOCK=500

# Output: 2u8 (Tier B)
# Also outputs commitment hash in "arguments" field

# 5. To revoke, use the commitment from prove output
make revoke COMMITMENT=6613525484358723320868794385596564615804189162981013393787560339710562192009field

# 6. Try to prove again - should fail (revoked)
make prove CRED="{...}" BLOCK=500
```

---

## Option 2: Local Devnet

For development without spending testnet credits. Requires running a local snarkOS node.

### Start Local Devnet

```bash
# Terminal 1 - Start the devnet
leo devnet --snarkos $(which snarkos) --snarkos-features test_network --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11 --clear-storage
```

Wait for block height to reach 12+.

### Configure .env for Local

```bash
PRIVATE_KEY=APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH
ENDPOINT=http://localhost:3030
NETWORK=testnet
```

### Deploy and Test

```bash
# Deploy
leo deploy --network testnet --broadcast --endpoint http://localhost:3030

# Add issuer
leo execute add_issuer aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0 \
  --network testnet --broadcast --endpoint http://localhost:3030

# Issue credential
leo execute issue \
  aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0 \
  750u16 \
  50000000u32 \
  12345field \
  --network testnet --broadcast --endpoint http://localhost:3030

# Prove tier
leo execute prove_tier "<credential_record>" 500u32 \
  --network testnet --broadcast --endpoint http://localhost:3030

# Revoke
leo execute revoke <commitment>field \
  --network testnet --broadcast --endpoint http://localhost:3030
```

---

## Option 3: Local Testing with `leo run`

Quick logic testing without any network. **Note:** Mappings don't persist - issuer checks and revocation won't work.

```bash
# Build
leo build

# Issue (issuer check skipped locally)
leo run issue aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0 750u16 50000000u32 12345field

# Prove tier (revocation check skipped locally)
leo run prove_tier "{owner: aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0.private, score: 750u16.private, expiry: 50000000u32.private, issuer: aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0.private, nonce: 12345field.private, _nonce: 1234567890group.public, _version: 1u8.public}" 500u32

# Expected: 2u8 (Tier B)
```

---

## Contract Functions

### Admin Functions

| Function | Description |
|----------|-------------|
| `add_issuer(address)` | Approve an address to issue credentials |
| `remove_issuer(address)` | Remove issuer approval |
| `revoke(commitment)` | Revoke a credential by its commitment hash |

### Issuer Functions

| Function | Description |
|----------|-------------|
| `issue(recipient, score, expiry, nonce)` | Issue a credential to a trader |

### Trader Functions

| Function | Description |
|----------|-------------|
| `prove_tier(credential, current_block)` | Prove tier eligibility (returns tier 0-3) |
| `prove_min_tier(credential, required_tier, current_block)` | Prove minimum tier access (returns bool) |

---

## Privacy Guarantees

| Data | Stored On-Chain | Visible to Public |
|------|-----------------|-------------------|
| Credit Score | ❌ No | ❌ No |
| Owner Address | ❌ No | ❌ No |
| Expiry Date | ❌ No | ❌ No |
| Commitment (hash) | ✅ Yes | ✅ Yes (but unlinkable) |
| Tier Result | - | ✅ Only when proving |

**Key Privacy Properties:**
- Commitment is a one-way hash - cannot be reversed
- No link between commitment and user identity
- Score never leaves the private record
- Only the tier (1/2/3) is revealed during proof

---

## Recovering Lost Credentials

If you lose your credential record, you can recover it from the blockchain using your private key:

### 1. Find your transaction
```bash
# If you know the transaction ID
curl -s "https://api.explorer.provable.com/v1/testnet/transaction/<TX_ID>" | jq .
```

### 2. Decrypt the record
```bash
# Get your view key
snarkos account view-key --private-key <YOUR_PRIVATE_KEY>

# Decrypt the record from transaction output
snarkos developer decrypt \
  --ciphertext "record1qvq..." \
  --view-key <YOUR_VIEW_KEY>
```

---

## Integration with Uniswap V4 Hook

This credential system is designed to work with a Uniswap V4 Hook for tiered AMM access:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      ALEO       │     │     RELAYER     │     │   ETH HOOK      │
│                 │     │                 │     │                 │
│ 1. Issue cred   │     │                 │     │                 │
│ 2. prove_tier() │────▶│ 3. Verify proof │────▶│ 4. Register     │
│    → tier: 2    │     │    Check chain  │     │    trader tier  │
│                 │     │    Sign attesta │     │ 5. Apply limits │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Project Structure

```
trustlayer_credentials/
├── src/
│   └── main.leo          # Main contract
├── Makefile              # Testnet commands
├── program.json          # Program configuration
├── .env                  # Environment variables
└── README.md             # This file
```

## Prerequisites

- [Leo](https://developer.aleo.org/leo/) installed (`cargo install leo-lang`)
- [snarkOS](https://github.com/AleoHQ/snarkOS) installed (`cargo install snarkos`) - for devnet/recovery
- Aleo account with testnet credits (for testnet deployment)

## Resources

- [Aleo Documentation](https://developer.aleo.org/)
- [Leo Language Guide](https://developer.aleo.org/leo/)
- [Aleo Explorer](https://explorer.aleo.org/)
- [Aleo Faucet](https://faucet.aleo.org/)

## License

MIT
