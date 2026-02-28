const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============ ALEO BACKEND API ============

export async function getBlockHeight() {
  const res = await fetch(`${API_BASE}/api/block-height`);
  return res.json();
}

export async function verifyProof(txId) {
  const res = await fetch(`${API_BASE}/api/verify-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId }),
  });
  return res.json();
}

export async function getTransaction(txId) {
  const res = await fetch(`${API_BASE}/api/transaction/${txId}`);
  return res.json();
}

export async function checkIssuer(address) {
  const res = await fetch(`${API_BASE}/api/issuer/${address}`);
  return res.json();
}

export async function checkCredential(commitment) {
  const res = await fetch(`${API_BASE}/api/verify/${commitment}`);
  return res.json();
}

// ============ ETH BACKEND API ============

export async function getHookInfo() {
  const res = await fetch(`${API_BASE}/api/eth/hook-info`);
  return res.json();
}

export async function getTraderInfo(address) {
  const res = await fetch(`${API_BASE}/api/eth/trader/${address}`);
  return res.json();
}

export async function getTierConfig(tier) {
  const res = await fetch(`${API_BASE}/api/eth/tier/${tier}`);
  return res.json();
}

export async function checkCanSwap(address, amount) {
  const res = await fetch(`${API_BASE}/api/eth/can-swap/${address}/${amount}`);
  return res.json();
}

export async function registerTrader(aleoTxId, ethAddress, expiryBlocks) {
  const res = await fetch(`${API_BASE}/api/eth/register-trader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aleoTxId, ethAddress, expiryBlocks }),
  });
  return res.json();
}

export async function revokeTrader(ethAddress, aleoCommitment) {
  const res = await fetch(`${API_BASE}/api/eth/revoke-trader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ethAddress, aleoCommitment }),
  });
  return res.json();
}

// ============ ISSUER API (new endpoints) ============

export async function issueCredential(recipient, score, expiry, nonce) {
  const res = await fetch(`${API_BASE}/api/aleo/issue-credential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, score, expiry, nonce }),
  });
  return res.json();
}

export async function addIssuer(issuerAddress) {
  const res = await fetch(`${API_BASE}/api/aleo/add-issuer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issuerAddress }),
  });
  return res.json();
}

export async function removeIssuer(issuerAddress) {
  const res = await fetch(`${API_BASE}/api/aleo/remove-issuer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issuerAddress }),
  });
  return res.json();
}

export async function revokeCredential(commitment) {
  const res = await fetch(`${API_BASE}/api/aleo/revoke-credential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitment }),
  });
  return res.json();
}

export async function getIssuedCredentials() {
  const res = await fetch(`${API_BASE}/api/aleo/credentials`);
  return res.json();
}

export async function fetchCredentialFromTx(txId) {
  const res = await fetch(`${API_BASE}/api/aleo/fetch-credential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId }),
  });
  return res.json();
}

export async function decryptRecord(ciphertext, viewKey) {
  const res = await fetch(`${API_BASE}/api/aleo/decrypt-record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext, viewKey }),
  });
  return res.json();
}

export async function proveTierBackend(record) {
  const res = await fetch(`${API_BASE}/api/aleo/prove-tier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record }),
  });
  return res.json();
}
