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
│  ├── expiry: 1000000                                         │
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

## Project Structure

```
trustlayer_credentials/
├── src/
│   └── main.leo          # Main contract
├── program.json          # Program configuration
├── .env                  # Environment variables
└── README.md             # This file
```

## Prerequisites

- [Leo](https://developer.aleo.org/leo/) installed (`cargo install leo-lang`)
- [snarkOS](https://github.com/AleoHQ/snarkOS) installed (`cargo install snarkos`)
- Aleo account with testnet credits

## Environment Setup

Create a `.env` file:

```bash
# For local devnet
PRIVATE_KEY=APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH
ENDPOINT=http://localhost:3030
NETWORK=testnet

# For public testnet
# ENDPOINT=https://api.explorer.provable.com/v1
```

Generate a new account if needed:

```bash
leo account new
```

## Local Testing with `leo run`

`leo run` executes transitions locally without persisting state. Good for quick testing of logic.

```bash
# Build the program
leo build

# Test issue (note: won't check issuer approval locally)
leo run issue aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px 750u16 1000000u32 12345field

# Copy the credential output, then test prove_tier
leo run prove_tier "{
  owner: aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px.private,
  score: 750u16.private,
  expiry: 1000000u32.private,
  issuer: aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px.private,
  nonce: 12345field.private,
  _nonce: <from_issue_output>group.public,
  _version: 1u8.public
}" 500u32

# Expected output: 2u8 (Tier B for score 750)
```

**Note:** `leo run` does not persist mappings. Issuer approval, revocation, and issuance checks only work on-chain.

## Local Devnet Testing

For full testing including mappings and finalize functions:

### 1. Start Local Devnet

```bash
# Terminal 1
leo devnet --snarkos $(which snarkos) --snarkos-features test_network --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11 --clear-storage
```

Wait for the devnet to produce blocks.

### 2. Deploy Contract

```bash
# Terminal 2
cd trustlayer_credentials
leo deploy --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11
```

### 3. Setup Issuer

```bash
# Add yourself as approved issuer
leo execute add_issuer aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px \
  --network testnet --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11
```

### 4. Issue Credential

```bash
# Issue credential to a trader
leo execute issue \
  aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px \
  750u16 \
  1000000u32 \
  99999field \
  --network testnet --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11
```

### 5. Prove Tier

```bash
# Use the credential from issue output
leo execute prove_tier "<credential_record>" 500u32 \
  --network testnet --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11
```

### 6. Test Revocation

```bash
# Get commitment hash (hash of nonce 99999field)
# Revoke the credential
leo execute revoke <commitment_hash> \
  --network testnet --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11

# Try to prove again - should fail!
leo execute prove_tier "<credential_record>" 500u32 \
  --network testnet --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11
```

## Public Testnet Deployment

### 1. Get Testnet Credits

Visit the [Aleo Faucet](https://faucet.aleo.org) and request credits for your address.

### 2. Check Balance

```bash
# Get your address
leo account address

# Check balance
curl "https://api.explorer.provable.com/v1/testnet/mapping/credits.aleo/account/<YOUR_ADDRESS>"
```

### 3. Deploy

```bash
leo deploy --network testnet --broadcast
```

### 4. Execute Functions

```bash
# Add issuer
leo execute add_issuer <issuer_address> --network testnet --broadcast

# Issue credential
leo execute issue <recipient> <score>u16 <expiry>u32 <nonce>field --network testnet --broadcast

# Prove tier
leo execute prove_tier "<credential>" <current_block>u32 --network testnet --broadcast
```

## Query Mappings

Check on-chain state:

```bash
# Check if issuer is approved
curl "https://api.explorer.provable.com/v1/testnet/program/trustlayer_credentials.aleo/mapping/approved_issuers/<address>"

# Check if credential was issued (need commitment hash)
curl "https://api.explorer.provable.com/v1/testnet/program/trustlayer_credentials.aleo/mapping/issued/<commitment>"

# Check if credential was revoked
curl "https://api.explorer.provable.com/v1/testnet/program/trustlayer_credentials.aleo/mapping/revoked/<commitment>"
```

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

The relayer:
1. Receives proof output from Aleo
2. Verifies `issued[commitment] == true`
3. Verifies `revoked[commitment] == false`
4. Signs attestation for Ethereum
5. Hook registers trader with their tier

## Test Scenarios

### Happy Path
```bash
# 1. Admin adds issuer
leo execute add_issuer <issuer> --network testnet --broadcast

# 2. Issuer creates credential (score 750 = Tier B)
leo execute issue <trader> 750u16 1000000u32 <nonce>field --network testnet --broadcast

# 3. Trader proves tier
leo execute prove_tier "<cred>" 500u32 --network testnet --broadcast
# Output: 2u8 ✓
```

### Revocation
```bash
# 1. Admin revokes credential
leo execute revoke <commitment> --network testnet --broadcast

# 2. Trader tries to prove - FAILS
leo execute prove_tier "<cred>" 500u32 --network testnet --broadcast
# Output: Error (assertion failed) ✓
```

### Unauthorized Issuer
```bash
# 1. Non-approved address tries to issue - FAILS
leo execute issue <trader> 750u16 1000000u32 <nonce>field --network testnet --broadcast
# Output: Error (not approved) ✓
```

### Expired Credential
```bash
# 1. Issue with low expiry
leo execute issue <trader> 750u16 100u32 <nonce>field --network testnet --broadcast

# 2. Try to prove with current_block > expiry - FAILS
leo execute prove_tier "<cred>" 500u32 --network testnet --broadcast
# Output: Error (assertion failed) ✓
```

## Security Considerations

1. **Admin Key Security**: The admin address is hardcoded. In production, consider multisig or DAO governance.

2. **Nonce Generation**: Use cryptographically secure random nonces to prevent guessing.

3. **Expiry Management**: Set appropriate expiry blocks based on credential validity requirements.

4. **Commitment Privacy**: The commitment hash cannot be reversed, but issuing many credentials may create timing correlations.

## Resources

- [Aleo Documentation](https://developer.aleo.org/)
- [Leo Language Guide](https://developer.aleo.org/leo/)
- [Aleo Explorer](https://explorer.aleo.org/)
- [TrustLayer AMM Architecture](../README.md)

## License

MIT
