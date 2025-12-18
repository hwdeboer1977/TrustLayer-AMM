# TrustLayer AMM: A ZK Credit-Score–Weighted AMM (Aleo) — Starter README

A proof-of-concept AMM on **Aleo** where **swap parameters depend on a trader’s private credit/trust credential**, verified via **zero-knowledge proofs**.

**Goal:** Counterparty-aware liquidity for **stablecoin / RWA pools** without doxxing identities or exposing scores on-chain.

---

## Core Idea

Traders present a **ZK proof** that they satisfy a **policy predicate** (e.g., `score >= 700`, not expired, issued by an approved issuer, optionally within a whitelist set).

The AMM uses the resulting **tier** (A/B/C/...) to set:

- `fee_bps` (dynamic fee per tier)
- `max_trade_in` / `max_trade_out` (position limits)
- optional: throttling/cooldowns in stress regimes

The pool never sees the raw score, identity, or underlying data — only a **verified tier/policy verdict**.

---

## High-Level Architecture

### Actors

1. **Issuer / Attestor**

   - Produces a private credential for a trader (score + expiry + subject key + nonce)
   - Publishes only a **commitment registry** on-chain (e.g., a Merkle root per epoch)

2. **Trader**

   - Holds the credential privately
   - Generates a ZK proof: “My credential is in the latest root AND meets predicate AND not expired”

3. **AMM Program**
   - Verifies proof inside the swap call
   - Derives `tier`
   - Applies tier-based params and executes AMM math

---

## Repository Structure (suggested)

```
zk-credit-amm/
├─ programs/
│  ├─ credit_registry/               # issuer roots, revocations, policy config
│  │  ├─ program.json
│  │  └─ src/main.leo
│  ├─ zk_policy/                     # ZK circuits: membership + range + expiry
│  │  ├─ program.json
│  │  └─ src/main.leo
│  └─ amm_pool/                      # AMM logic + tier-based parameterization
│     ├─ program.json
│     └─ src/main.leo
│
├─ sdk/
│  ├─ js/
│  │  ├─ issuer/                     # creates credentials, builds commitments, updates roots
│  │  ├─ trader/                     # builds proofs, submits swaps
│  │  └─ common/                     # types, config, aleo client wrappers
│  └─ README.md
│
├─ specs/
│  ├─ credential_format.md
│  ├─ threat_model.md
│  └─ economics.md
│
├─ scripts/
│  ├─ devnet_deploy.sh
│  ├─ seed_pool.sh
│  └─ demo_flow.sh
│
└─ README.md
```

> You can start with **one program** and later split into three. For MVP, it’s fine to keep `registry + policy + amm` in a single Aleo program.

---

## Data Model

### Credential (private, held by trader)

**Fields (example):**

- `subject_pk` (trader public key / address binding)
- `score` (u16 or u32)
- `expiry_ts` (u64)
- `issuer_id` (u32)
- `nonce` (u64 random)

**Commitment:**

- `C = Hash(subject_pk || score || expiry_ts || issuer_id || nonce)`

### On-chain state (public)

- `current_epoch: u32`
- `root_by_epoch[epoch] -> field` (Merkle root for valid commitments)
- optional: `revoked_commitments[commitment] -> bool`
- policy config: `tier thresholds`, max sizes, fee tables

---

## Tier Policy (example)

| Tier | Predicate (ZK)    | fee_bps | max_in          | Notes           |
| ---- | ----------------- | ------- | --------------- | --------------- |
| A    | score ≥ 800       | 3       | high            | “institutional” |
| B    | 700 ≤ score < 800 | 8       | med             |                 |
| C    | 600 ≤ score < 700 | 15      | low             |                 |
| D    | score < 600       | 30      | very low / deny | optional gate   |

**MVP recommendation:** do **tier-based** (discrete) rather than continuous mapping to avoid weird incentive cliffs.

---

## Program Responsibilities

### 1) `credit_registry` program

- `set_root(epoch, root)` — controlled by issuer governance
- `set_policy(...)` — tier thresholds, fee table, limits
- optional: `revoke(commitment)` — revocation list

### 2) `zk_policy` program (proof verification helpers)

- Verifies:
  - Merkle membership: commitment ∈ root
  - Range predicate: score meets tier threshold
  - Expiry: `now <= expiry_ts`
  - Binding: `subject_pk == caller_pk` (prevents credential sharing)

### 3) `amm_pool` program

- Pool state (reserves, fee accrual)
- `swap_exact_in(...)`:
  1. verify ZK policy proof
  2. compute tier
  3. enforce `max_in`, compute `fee_bps`
  4. run AMM math (CPMM for MVP)
  5. update reserves + fee accounting

---

## Minimal MVP: CPMM + Tier Fees

Start with a constant product AMM:

- reserves: `x`, `y`
- invariant: `x * y = k`
- apply tier fee: `amount_in_after_fee = amount_in * (1 - fee_bps/10_000)`

Then extend later to:

- dynamic throttling under stress
- oracle bounds (stable peg band)
- RWA pool-specific controls

---

## Demo Flow (end-to-end)

1. **Issuer** generates credential and commitment for Trader
2. Issuer adds commitment to Merkle tree and publishes **root** on-chain for `epoch`
3. Trader generates proof:
   - membership in `root`
   - score threshold (tier)
   - not expired
   - bound to trader address
4. Trader calls `amm_pool.swap_exact_in(proof, public_inputs, amount_in, min_out)`
5. AMM verifies proof and executes swap with tier params

---

## Security & Abuse Checklist (must-have)

- **Anti-sharing**: bind credential to trader key (`subject_pk == caller`)
- **Expiry**: enforce expiry inside ZK circuit
- **Revocation**: allow issuer to revoke commitments (or rotate epoch roots)
- **Sybil controls**: issuer-level uniqueness rules; optional “one credential per subject”
- **DoS protection**: max proof size, compute limits, graceful failure
- **Governance**: multiple issuers / multisig / DAO for root updates and policy

---

## Roadmap

### Phase 0 — Skeleton

- repo structure
- policy table + types
- stub programs and dummy verification

### Phase 1 — Working Proof + Swap

- Merkle membership proof (single root)
- range proof (tier)
- CPMM swap with tier fee

### Phase 2 — Production-leaning features

- revocation / epoch rotation
- multi-issuer roots
- stress controls: throttling/circuit breaker
- accounting: fees by LP share, treasury rake

### Phase 3 — RWA integrations

- allowlisted institutions (membership-only tier)
- compliance predicates (sanctions ok, residency ok) via ZK attestations
- off-chain audit channel (selective disclosure)

---

## Notes for Aleo Implementation

- Prefer **policy predicates** (range/membership) over revealing a numeric score.
- Keep **public inputs minimal**:
  - epoch/root id
  - tier id (or verified threshold id)
  - current timestamp (or block height-derived)
- Use salts/nonces in commitments to prevent linkage.

---

## License

MIT (recommended for PoC).
