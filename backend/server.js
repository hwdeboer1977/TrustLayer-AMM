const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Aleo config
const ALEO_ENDPOINT = process.env.ALEO_ENDPOINT || 'https://api.explorer.provable.com/v1';
const ALEO_NETWORK = process.env.ALEO_NETWORK || 'testnet';
const ALEO_PROGRAM = process.env.ALEO_PROGRAM || 'trustlayer_credentials_amm_v2.aleo';

// ============ HELPER FUNCTIONS ============

async function queryMapping(mappingName, key) {
    const url = `${ALEO_ENDPOINT}/${ALEO_NETWORK}/program/${ALEO_PROGRAM}/mapping/${mappingName}/${key}`;
    
    try {
        const response = await fetch(url);
        const data = await response.text();
        
        // Parse Aleo response (returns "true" or "false" or null)
        if (data === 'null' || data === '') {
            return null;
        }
        return data.replace(/"/g, '') === 'true';
    } catch (error) {
        console.error(`Error querying ${mappingName}:`, error);
        return null;
    }
}

async function getBlockHeight() {
    const url = `${ALEO_ENDPOINT}/${ALEO_NETWORK}/block/height/latest`;
    
    try {
        const response = await fetch(url);
        const height = await response.text();
        return parseInt(height);
    } catch (error) {
        console.error('Error getting block height:', error);
        return null;
    }
}

async function getTransaction(txId) {
    const url = `${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/${txId}`;
    
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Error getting transaction:', error);
        return null;
    }
}

// ============ API ROUTES ============

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', program: ALEO_PROGRAM });
});

// Get current block height
app.get('/api/block-height', async (req, res) => {
    const height = await getBlockHeight();
    
    if (height === null) {
        return res.status(500).json({ error: 'Failed to get block height' });
    }
    
    res.json({ blockHeight: height });
});

// Check if issuer is approved
app.get('/api/issuer/:address', async (req, res) => {
    const { address } = req.params;
    
    const isApproved = await queryMapping('approved_issuers', address);
    
    res.json({
        address,
        isApproved: isApproved === true
    });
});

// Check if credential was issued
app.get('/api/issued/:commitment', async (req, res) => {
    const { commitment } = req.params;
    
    const wasIssued = await queryMapping('issued', commitment);
    
    res.json({
        commitment,
        wasIssued: wasIssued === true
    });
});

// Check if credential was revoked
app.get('/api/revoked/:commitment', async (req, res) => {
    const { commitment } = req.params;
    
    const isRevoked = await queryMapping('revoked', commitment);
    
    res.json({
        commitment,
        isRevoked: isRevoked === true
    });
});

// Verify a credential (check issued AND not revoked)
app.get('/api/verify/:commitment', async (req, res) => {
    const { commitment } = req.params;
    
    const [wasIssued, isRevoked] = await Promise.all([
        queryMapping('issued', commitment),
        queryMapping('revoked', commitment)
    ]);
    
    const isValid = wasIssued === true && isRevoked !== true;
    
    res.json({
        commitment,
        wasIssued: wasIssued === true,
        isRevoked: isRevoked === true,
        isValid
    });
});

// Get transaction details (to extract tier from prove_tier tx)
app.get('/api/transaction/:txId', async (req, res) => {
    const { txId } = req.params;
    
    const tx = await getTransaction(txId);
    
    if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Extract tier and commitment from prove_tier transaction
    let tier = null;
    let commitment = null;
    
    if (tx.execution && tx.execution.transitions) {
        for (const transition of tx.execution.transitions) {
            if (transition.function === 'prove_tier') {
                // Find public outputs
                for (const output of transition.outputs || []) {
                    if (output.type === 'public' && output.value) {
                        // Tier is like "2u8"
                        const tierMatch = output.value.match(/^(\d+)u8$/);
                        if (tierMatch) {
                            tier = parseInt(tierMatch[1]);
                        }
                    }
                    if (output.type === 'future' && output.value) {
                        // Extract commitment from future arguments
                        const commitmentMatch = output.value.match(/(\d+)field/);
                        if (commitmentMatch) {
                            commitment = commitmentMatch[1] + 'field';
                        }
                    }
                }
            }
        }
    }
    
    res.json({
        txId,
        tier,
        commitment,
        raw: tx
    });
});

// Verify a prove_tier transaction and return tier info
app.post('/api/verify-proof', async (req, res) => {
    const { txId } = req.body;
    
    if (!txId) {
        return res.status(400).json({ error: 'txId is required' });
    }
    
    // Get transaction
    const tx = await getTransaction(txId);
    
    if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Extract tier and commitment
    let tier = null;
    let commitment = null;
    let currentBlock = null;
    
    if (tx.execution && tx.execution.transitions) {
        for (const transition of tx.execution.transitions) {
            if (transition.function === 'prove_tier' && transition.program === ALEO_PROGRAM) {
                // Get public inputs (current_block)
                for (const input of transition.inputs || []) {
                    if (input.type === 'public' && input.value) {
                        const blockMatch = input.value.match(/^(\d+)u32$/);
                        if (blockMatch) {
                            currentBlock = parseInt(blockMatch[1]);
                        }
                    }
                }
                
                // Get outputs
                for (const output of transition.outputs || []) {
                    if (output.type === 'public' && output.value) {
                        const tierMatch = output.value.match(/^(\d+)u8$/);
                        if (tierMatch) {
                            tier = parseInt(tierMatch[1]);
                        }
                    }
                    if (output.type === 'future' && output.value) {
                        const commitmentMatch = output.value.match(/(\d+)field/);
                        if (commitmentMatch) {
                            commitment = commitmentMatch[1] + 'field';
                        }
                    }
                }
            }
        }
    }
    
    if (tier === null || commitment === null) {
        return res.status(400).json({ error: 'Could not extract tier or commitment from transaction' });
    }
    
    // Verify credential is valid (issued and not revoked)
    const [wasIssued, isRevoked] = await Promise.all([
        queryMapping('issued', commitment),
        queryMapping('revoked', commitment)
    ]);
    
    const isValid = wasIssued === true && isRevoked !== true;
    
    // Map tier to name
    const tierNames = {
        0: 'Ineligible',
        1: 'Tier C (Basic)',
        2: 'Tier B (Pro)',
        3: 'Tier A (Whale)'
    };
    
    res.json({
        txId,
        tier,
        tierName: tierNames[tier] || 'Unknown',
        commitment,
        currentBlock,
        wasIssued: wasIssued === true,
        isRevoked: isRevoked === true,
        isValid,
        message: isValid 
            ? `Valid ${tierNames[tier]} credential` 
            : 'Invalid credential (not issued or revoked)'
    });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`TrustLayer Credentials API running on port ${PORT}`);
    console.log(`Aleo Program: ${ALEO_PROGRAM}`);
    console.log(`Aleo Endpoint: ${ALEO_ENDPOINT}`);
});
