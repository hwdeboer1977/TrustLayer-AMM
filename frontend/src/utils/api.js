// API utility functions

const API_URL = '/api';

// ============ ALEO ENDPOINTS ============

export async function getBlockHeight() {
    const res = await fetch(`${API_URL}/block-height`);
    return res.json();
}

export async function verifyProof(txId) {
    const res = await fetch(`${API_URL}/verify-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId })
    });
    return res.json();
}

export async function checkCommitment(commitment) {
    const res = await fetch(`${API_URL}/verify/${commitment}`);
    return res.json();
}

export async function checkIssuer(address) {
    const res = await fetch(`${API_URL}/issuer/${address}`);
    return res.json();
}

// ============ ETHEREUM ENDPOINTS ============

export async function getHookInfo() {
    const res = await fetch(`${API_URL}/eth/hook-info`);
    return res.json();
}

export async function getTraderInfo(address) {
    const res = await fetch(`${API_URL}/eth/trader/${address}`);
    return res.json();
}

export async function getTierConfig(tier) {
    const res = await fetch(`${API_URL}/eth/tier/${tier}`);
    return res.json();
}

export async function checkCanSwap(address, amount) {
    const res = await fetch(`${API_URL}/eth/can-swap/${address}/${amount}`);
    return res.json();
}

export async function registerTrader(aleoTxId, ethAddress, expiryBlocks = 100000) {
    const res = await fetch(`${API_URL}/eth/register-trader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aleoTxId, ethAddress, expiryBlocks })
    });
    return res.json();
}

export async function revokeTrader(ethAddress, aleoCommitment = null) {
    const res = await fetch(`${API_URL}/eth/revoke-trader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ethAddress, aleoCommitment })
    });
    return res.json();
}
