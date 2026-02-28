const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
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

// Aleo admin/issuer key (for issuing credentials, managing issuers, revoking)
const ALEO_PRIVATE_KEY = process.env.ALEO_PRIVATE_KEY;

// Ethereum/Arbitrum config
const ETH_RPC = process.env.ARB_RPC || process.env.ETH_RPC || 'http://127.0.0.1:8545';
const RELAYER_PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
const HOOK_ADDRESS = process.env.HOOK_ADDRESS;

// TrustLayerHook ABI (only the functions we need)
const HOOK_ABI = [
    "function registerTrader(address trader, uint8 tier, bytes32 commitment, uint256 expiry) external",
    "function revokeTrader(address trader) external",
    "function getTraderInfo(address trader) external view returns (tuple(uint8 tier, uint256 registeredAt, uint256 expiry, bytes32 commitment))",
    "function getTierConfig(uint8 tier) external view returns (tuple(uint24 feeBps, uint256 maxTradeSize, bool enabled))",
    "function canSwap(address trader, uint256 tradeSize) external view returns (bool, string memory)",
    "function previewFee(address trader) external view returns (uint24)",
    "function admin() external view returns (address)",
    "function relayer() external view returns (address)"
];

// Initialize Ethereum provider and wallet
let provider, relayerWallet, hookContract;

if (ETH_RPC && RELAYER_PRIVATE_KEY && HOOK_ADDRESS) {
    provider = new ethers.JsonRpcProvider(ETH_RPC);
    relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    hookContract = new ethers.Contract(HOOK_ADDRESS, HOOK_ABI, relayerWallet);
    console.log('Ethereum relayer initialized:', relayerWallet.address);
    console.log('Hook address:', HOOK_ADDRESS);
    console.log('RPC:', ETH_RPC);
} else {
    console.warn('Ethereum config missing - ETH endpoints disabled');
    console.warn('  ARB_RPC:', ETH_RPC ? 'SET' : 'MISSING');
    console.warn('  PRIVATE_KEY:', RELAYER_PRIVATE_KEY ? 'SET' : 'MISSING');
    console.warn('  HOOK_ADDRESS:', HOOK_ADDRESS ? 'SET' : 'MISSING');
}

// ============ HELPER FUNCTIONS ============

async function queryMapping(mappingName, key) {
    const url = `${ALEO_ENDPOINT}/${ALEO_NETWORK}/program/${ALEO_PROGRAM}/mapping/${mappingName}/${key}`;
    
    try {
        const response = await fetch(url);
        const data = await response.text();
        
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

// ============ ALEO API ROUTES ============

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        program: ALEO_PROGRAM,
        ethEnabled: !!hookContract
    });
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
    res.json({ address, isApproved: isApproved === true });
});

// Check if credential was issued
app.get('/api/issued/:commitment', async (req, res) => {
    const { commitment } = req.params;
    const wasIssued = await queryMapping('issued', commitment);
    res.json({ commitment, wasIssued: wasIssued === true });
});

// Check if credential was revoked
app.get('/api/revoked/:commitment', async (req, res) => {
    const { commitment } = req.params;
    const isRevoked = await queryMapping('revoked', commitment);
    res.json({ commitment, isRevoked: isRevoked === true });
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

// Get transaction details
app.get('/api/transaction/:txId', async (req, res) => {
    const { txId } = req.params;
    const tx = await getTransaction(txId);
    
    if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    
    let tier = null;
    let commitment = null;
    
    if (tx.execution && tx.execution.transitions) {
        for (const transition of tx.execution.transitions) {
            if (transition.function === 'prove_tier') {
                for (const output of transition.outputs || []) {
                    if (output.type === 'public' && output.value) {
                        const tierMatch = output.value.match(/^(\d+)u8$/);
                        if (tierMatch) tier = parseInt(tierMatch[1]);
                    }
                    if (output.type === 'future' && output.value) {
                        const commitmentMatch = output.value.match(/(\d+)field/);
                        if (commitmentMatch) commitment = commitmentMatch[1] + 'field';
                    }
                }
            }
        }
    }
    
    res.json({ txId, tier, commitment, raw: tx });
});

// Verify a prove_tier transaction
app.post('/api/verify-proof', async (req, res) => {
    const { txId } = req.body;
    
    if (!txId) {
        return res.status(400).json({ error: 'txId is required' });
    }
    
    const tx = await getTransaction(txId);
    
    if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    
    let tier = null;
    let commitment = null;
    let currentBlock = null;
    
    if (tx.execution && tx.execution.transitions) {
        for (const transition of tx.execution.transitions) {
            if (transition.function === 'prove_tier' && transition.program === ALEO_PROGRAM) {
                for (const input of transition.inputs || []) {
                    if (input.type === 'public' && input.value) {
                        const blockMatch = input.value.match(/^(\d+)u32$/);
                        if (blockMatch) currentBlock = parseInt(blockMatch[1]);
                    }
                }
                
                for (const output of transition.outputs || []) {
                    if (output.type === 'public' && output.value) {
                        const tierMatch = output.value.match(/^(\d+)u8$/);
                        if (tierMatch) tier = parseInt(tierMatch[1]);
                    }
                    if (output.type === 'future' && output.value) {
                        const commitmentMatch = output.value.match(/(\d+)field/);
                        if (commitmentMatch) commitment = commitmentMatch[1] + 'field';
                    }
                }
            }
        }
    }
    
    if (tier === null || commitment === null) {
        return res.status(400).json({ error: 'Could not extract tier or commitment from transaction' });
    }
    
    const [wasIssued, isRevoked] = await Promise.all([
        queryMapping('issued', commitment),
        queryMapping('revoked', commitment)
    ]);
    
    const isValid = wasIssued === true && isRevoked !== true;
    
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
        message: isValid ? `Valid ${tierNames[tier]} credential` : 'Invalid credential (not issued or revoked)'
    });
});

// ============ ETHEREUM ENDPOINTS ============

// Get hook info
app.get('/api/eth/hook-info', async (req, res) => {
    if (!hookContract) {
        return res.status(503).json({ error: 'Ethereum not configured' });
    }

    try {
        const [admin, relayer] = await Promise.all([
            hookContract.admin(),
            hookContract.relayer()
        ]);

        res.json({
            hookAddress: HOOK_ADDRESS,
            admin,
            relayer,
            relayerConfigured: relayerWallet.address
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get trader info from Ethereum hook
app.get('/api/eth/trader/:address', async (req, res) => {
    if (!hookContract) {
        return res.status(503).json({ error: 'Ethereum not configured' });
    }

    try {
        const { address } = req.params;
        const info = await hookContract.getTraderInfo(address);
        
        const tierNames = {
            0: 'Unregistered',
            1: 'Tier C (Basic)',
            2: 'Tier B (Pro)',
            3: 'Tier A (Whale)'
        };

        res.json({
            address,
            tier: Number(info.tier),
            tierName: tierNames[info.tier] || 'Unknown',
            registeredAt: Number(info.registeredAt),
            expiry: Number(info.expiry),
            commitment: info.commitment,
            isRegistered: Number(info.tier) > 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tier config
app.get('/api/eth/tier/:tier', async (req, res) => {
    if (!hookContract) {
        return res.status(503).json({ error: 'Ethereum not configured' });
    }

    try {
        const tier = parseInt(req.params.tier);
        const config = await hookContract.getTierConfig(tier);

        res.json({
            tier,
            feeBps: Number(config.feeBps),
            feePercent: Number(config.feeBps) / 10000,
            maxTradeSize: config.maxTradeSize.toString(),
            maxTradeSizeFormatted: ethers.formatEther(config.maxTradeSize),
            enabled: config.enabled
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check if trader can swap
app.get('/api/eth/can-swap/:address/:amount', async (req, res) => {
    if (!hookContract) {
        return res.status(503).json({ error: 'Ethereum not configured' });
    }

    try {
        const { address, amount } = req.params;
        const amountWei = ethers.parseEther(amount);
        const [canSwap, reason] = await hookContract.canSwap(address, amountWei);

        res.json({
            address,
            amount,
            amountWei: amountWei.toString(),
            canSwap,
            reason
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Register trader on Ethereum (after verifying Aleo proof)
app.post('/api/eth/register-trader', async (req, res) => {
    if (!hookContract) {
        return res.status(503).json({ error: 'Ethereum not configured' });
    }

    const { aleoTxId, ethAddress, expiryBlocks } = req.body;

    if (!aleoTxId || !ethAddress) {
        return res.status(400).json({ error: 'aleoTxId and ethAddress are required' });
    }

    try {
        // Step 1: Verify Aleo proof
        const tx = await getTransaction(aleoTxId);
        if (!tx) {
            return res.status(404).json({ error: 'Aleo transaction not found' });
        }

        // Extract tier and commitment from Aleo tx
        let tier = null;
        let commitment = null;

        if (tx.execution && tx.execution.transitions) {
            for (const transition of tx.execution.transitions) {
                if (transition.function === 'prove_tier' && transition.program === ALEO_PROGRAM) {
                    for (const output of transition.outputs || []) {
                        if (output.type === 'public' && output.value) {
                            const tierMatch = output.value.match(/^(\d+)u8$/);
                            if (tierMatch) tier = parseInt(tierMatch[1]);
                        }
                        if (output.type === 'future' && output.value) {
                            const commitmentMatch = output.value.match(/(\d+)field/);
                            if (commitmentMatch) commitment = commitmentMatch[1] + 'field';
                        }
                    }
                }
            }
        }

        if (tier === null || commitment === null) {
            return res.status(400).json({ error: 'Could not extract tier/commitment from Aleo transaction' });
        }

        if (tier === 0) {
            return res.status(400).json({ error: 'Tier 0 (Ineligible) cannot be registered' });
        }

        // Step 2: Verify credential is valid on Aleo (issued and not revoked)
        const [wasIssued, isRevoked] = await Promise.all([
            queryMapping('issued', commitment),
            queryMapping('revoked', commitment)
        ]);

        if (!wasIssued) {
            return res.status(400).json({ error: 'Credential was not issued on Aleo' });
        }

        if (isRevoked) {
            return res.status(400).json({ error: 'Credential has been revoked on Aleo' });
        }

        // Step 3: Register on Ethereum
        const currentBlock = await provider.getBlockNumber();
        const expiry = currentBlock + (expiryBlocks || 100000);
        
        const commitmentNum = commitment.replace('field', '');
        const commitmentBytes32 = ethers.zeroPadValue(
            ethers.toBeHex(BigInt(commitmentNum)), 
            32
        );

        const txResponse = await hookContract.registerTrader(
            ethAddress,
            tier,
            commitmentBytes32,
            expiry
        );

        const receipt = await txResponse.wait();

        const tierNames = {
            1: 'Tier C (Basic)',
            2: 'Tier B (Pro)',
            3: 'Tier A (Whale)'
        };

        res.json({
            success: true,
            message: `Successfully registered ${tierNames[tier]} trader`,
            aleoTxId,
            ethTxHash: receipt.hash,
            trader: ethAddress,
            tier,
            tierName: tierNames[tier],
            commitment: commitmentBytes32,
            expiry,
            blockNumber: receipt.blockNumber
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Revoke trader on Ethereum
app.post('/api/eth/revoke-trader', async (req, res) => {
    if (!hookContract) {
        return res.status(503).json({ error: 'Ethereum not configured' });
    }

    const { ethAddress, aleoCommitment } = req.body;

    if (!ethAddress) {
        return res.status(400).json({ error: 'ethAddress is required' });
    }

    try {
        if (aleoCommitment) {
            const isRevoked = await queryMapping('revoked', aleoCommitment);
            if (!isRevoked) {
                return res.status(400).json({ 
                    error: 'Credential not revoked on Aleo. Revoke on Aleo first.' 
                });
            }
        }

        const txResponse = await hookContract.revokeTrader(ethAddress);
        const receipt = await txResponse.wait();

        res.json({
            success: true,
            message: 'Trader revoked successfully',
            ethTxHash: receipt.hash,
            trader: ethAddress,
            blockNumber: receipt.blockNumber
        });

    } catch (error) {
        console.error('Revocation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ALEO ISSUER / ADMIN ROUTES ============

// Helper: compute tier from score
function tierFromScore(score) {
    if (score >= 800) return { tier: 3, name: 'Tier A (Whale)' };
    if (score >= 700) return { tier: 2, name: 'Tier B (Pro)' };
    if (score >= 600) return { tier: 1, name: 'Tier C (Basic)' };
    return { tier: 0, name: 'Ineligible' };
}

// Issue a credential to a user on Aleo
// POST /api/aleo/issue-credential
// Body: { recipient, score, expiry, nonce }
app.post('/api/aleo/issue-credential', async (req, res) => {
    const { recipient, score, expiry, nonce } = req.body;

    if (!recipient || score === undefined || !expiry || !nonce) {
        return res.status(400).json({ error: 'Missing required fields: recipient, score, expiry, nonce' });
    }

    const scoreInt = parseInt(score);
    const expiryInt = parseInt(expiry);

    if (scoreInt < 0 || scoreInt > 1000) {
        return res.status(400).json({ error: 'Score must be between 0 and 1000' });
    }

    if (expiryInt < 1 || expiryInt > 4294967295) {
        return res.status(400).json({ error: 'Expiry must be a valid u32 (1 to 4294967295). Use a realistic Aleo block height like 500000.' });
    }

    if (!ALEO_PRIVATE_KEY) {
        return res.status(503).json({ error: 'Aleo private key not configured. Set ALEO_PRIVATE_KEY in .env' });
    }

    // Ensure nonce has 'field' suffix
    const nonceStr = nonce.toString().endsWith('field') ? nonce.toString() : `${nonce}field`;

    try {
        const command = [
            'snarkos developer execute',
            ALEO_PROGRAM,
            'issue',
            `${recipient}`,
            `${scoreInt}u16`,
            `${expiryInt}u32`,
            nonceStr,
            `--private-key ${ALEO_PRIVATE_KEY}`,
            `--query ${ALEO_ENDPOINT}`,
            `--broadcast ${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/broadcast`,
            '--network 1',
        ].join(' ');

        console.log('Executing issue credential...');
        console.log(`  Recipient: ${recipient}, Score: ${score}, Expiry: ${expiry}`);

        const { stdout } = await execAsync(command, { timeout: 120000 });
        const txMatch = stdout.match(/at1[a-z0-9]+/);
        const tierInfo = tierFromScore(score);

        res.json({
            success: true,
            message: `Credential issued: ${tierInfo.name} (score: ${score})`,
            txId: txMatch ? txMatch[0] : null,
            recipient,
            score,
            expiry,
            nonce,
            tier: tierInfo.tier,
            tierName: tierInfo.name,
        });
    } catch (error) {
        console.error('Issue credential error:', error);
        res.status(500).json({
            error: `Failed to issue credential: ${error.message}`,
            hint: 'Make sure snarkos is installed and ALEO_PRIVATE_KEY belongs to an approved issuer.',
        });
    }
});

// Approve an issuer on Aleo (admin only)
// POST /api/aleo/add-issuer
// Body: { issuerAddress }
app.post('/api/aleo/add-issuer', async (req, res) => {
    const { issuerAddress } = req.body;
    if (!issuerAddress) return res.status(400).json({ error: 'issuerAddress is required' });
    if (!ALEO_PRIVATE_KEY) return res.status(503).json({ error: 'Aleo private key not configured' });

    try {
        const command = [
            'snarkos developer execute',
            ALEO_PROGRAM,
            'add_issuer',
            issuerAddress,
            `--private-key ${ALEO_PRIVATE_KEY}`,
            `--query ${ALEO_ENDPOINT}`,
            `--broadcast ${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/broadcast`,
            '--network 1',
        ].join(' ');

        const { stdout } = await execAsync(command, { timeout: 120000 });
        const txMatch = stdout.match(/at1[a-z0-9]+/);

        res.json({
            success: true,
            message: `Issuer ${issuerAddress.slice(0, 12)}... approved`,
            txId: txMatch ? txMatch[0] : null,
            issuerAddress,
        });
    } catch (error) {
        console.error('Add issuer error:', error);
        res.status(500).json({
            error: `Failed to add issuer: ${error.message}`,
            hint: 'Only the admin address can add issuers.',
        });
    }
});

// Remove an issuer on Aleo (admin only)
// POST /api/aleo/remove-issuer
// Body: { issuerAddress }
app.post('/api/aleo/remove-issuer', async (req, res) => {
    const { issuerAddress } = req.body;
    if (!issuerAddress) return res.status(400).json({ error: 'issuerAddress is required' });
    if (!ALEO_PRIVATE_KEY) return res.status(503).json({ error: 'Aleo private key not configured' });

    try {
        const command = [
            'snarkos developer execute',
            ALEO_PROGRAM,
            'remove_issuer',
            issuerAddress,
            `--private-key ${ALEO_PRIVATE_KEY}`,
            `--query ${ALEO_ENDPOINT}`,
            `--broadcast ${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/broadcast`,
            '--network 1',
        ].join(' ');

        const { stdout } = await execAsync(command, { timeout: 120000 });
        const txMatch = stdout.match(/at1[a-z0-9]+/);

        res.json({
            success: true,
            message: `Issuer ${issuerAddress.slice(0, 12)}... removed`,
            txId: txMatch ? txMatch[0] : null,
            issuerAddress,
        });
    } catch (error) {
        console.error('Remove issuer error:', error);
        res.status(500).json({ error: `Failed to remove issuer: ${error.message}` });
    }
});

// Revoke a credential on Aleo (admin only)
// POST /api/aleo/revoke-credential
// Body: { commitment }
app.post('/api/aleo/revoke-credential', async (req, res) => {
    const { commitment } = req.body;
    if (!commitment) return res.status(400).json({ error: 'commitment is required' });
    if (!ALEO_PRIVATE_KEY) return res.status(503).json({ error: 'Aleo private key not configured' });

    try {
        const command = [
            'snarkos developer execute',
            ALEO_PROGRAM,
            'revoke',
            commitment,
            `--private-key ${ALEO_PRIVATE_KEY}`,
            `--query ${ALEO_ENDPOINT}`,
            `--broadcast ${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/broadcast`,
            '--network 1',
        ].join(' ');

        const { stdout } = await execAsync(command, { timeout: 120000 });
        const txMatch = stdout.match(/at1[a-z0-9]+/);

        res.json({
            success: true,
            message: 'Credential revoked on Aleo',
            txId: txMatch ? txMatch[0] : null,
            commitment,
        });
    } catch (error) {
        console.error('Revoke credential error:', error);
        res.status(500).json({ error: `Failed to revoke credential: ${error.message}` });
    }
});

// Note: Aleo mappings don't support enumeration
// GET /api/aleo/credentials
app.get('/api/aleo/credentials', async (req, res) => {
    res.json({
        message: 'Aleo mappings do not support enumeration. Use /api/verify/:commitment to check individual credentials.',
        hint: 'Track commitments in a database when issuing via /api/aleo/issue-credential.',
    });
});

// ============ CREDENTIAL RECORD DECRYPTION ============

// Execute prove_tier on behalf of the credential owner (demo mode: admin = owner)
// POST /api/aleo/prove-tier
// Body: { record } - the decrypted credential record plaintext
app.post('/api/aleo/prove-tier', async (req, res) => {
    const { record } = req.body;

    if (!record) {
        return res.status(400).json({ error: 'record (credential plaintext) is required' });
    }

    if (!ALEO_PRIVATE_KEY) {
        return res.status(503).json({ error: 'Aleo private key not configured. Set ALEO_PRIVATE_KEY in .env' });
    }

    try {
        // Fetch current block height for the second argument
        const fetch = (await import('node-fetch')).default;
        const heightRes = await fetch(`${ALEO_ENDPOINT}/${ALEO_NETWORK}/block/height/latest`);
        const currentBlock = await heightRes.json();

        console.log('Executing prove_tier...');
        console.log(`  Current block: ${currentBlock}`);

        // Clean up the record plaintext - ensure it's properly formatted
        const cleanRecord = record.trim();

        const command = [
            'snarkos developer execute',
            ALEO_PROGRAM,
            'prove_tier',
            `"${cleanRecord}"`,
            `${currentBlock}u32`,
            `--private-key ${ALEO_PRIVATE_KEY}`,
            `--query ${ALEO_ENDPOINT}`,
            `--broadcast ${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/broadcast`,
            '--network 1',
        ].join(' ');

        const { stdout, stderr } = await execAsync(command, { timeout: 300000 }); // 5 min timeout for proof generation
        const txMatch = stdout.match(/at1[a-z0-9]+/);

        console.log('prove_tier stdout:', stdout.slice(0, 500));
        if (stderr) console.log('prove_tier stderr:', stderr.slice(0, 300));

        res.json({
            success: true,
            message: 'ZK tier proof generated and broadcast!',
            txId: txMatch ? txMatch[0] : null,
            blockHeight: currentBlock,
        });
    } catch (error) {
        console.error('prove_tier error:', error);
        res.status(500).json({
            error: `Failed to execute prove_tier: ${error.message}`,
            hint: 'Make sure the credential record is valid and not already spent. The ALEO_PRIVATE_KEY must own this record.',
        });
    }
});

// Decrypt a record ciphertext using the view key
// POST /api/aleo/decrypt-record
// Body: { ciphertext, viewKey? }
app.post('/api/aleo/decrypt-record', async (req, res) => {
    const { ciphertext, viewKey } = req.body;
    const vk = viewKey || process.env.ALEO_VIEW_KEY;

    if (!ciphertext) return res.status(400).json({ error: 'ciphertext is required' });
    if (!vk) return res.status(503).json({ error: 'No view key available. Set ALEO_VIEW_KEY in .env or provide viewKey in request.' });

    try {
        const command = `snarkos developer decrypt --ciphertext "${ciphertext}" --view-key "${vk}"`;
        const { stdout } = await execAsync(command, { timeout: 30000 });
        const plaintext = stdout.trim();

        res.json({
            success: true,
            plaintext,
        });
    } catch (error) {
        console.error('Decrypt error:', error);
        res.status(500).json({ error: `Failed to decrypt: ${error.message}` });
    }
});

// Fetch credential record from a transaction and decrypt it
// POST /api/aleo/fetch-credential
// Body: { txId, viewKey? }
app.post('/api/aleo/fetch-credential', async (req, res) => {
    const { txId, viewKey } = req.body;
    const vk = viewKey || process.env.ALEO_VIEW_KEY;

    if (!txId) return res.status(400).json({ error: 'txId is required' });
    if (!vk) return res.status(503).json({ error: 'No view key available. Set ALEO_VIEW_KEY in .env or provide viewKey in request.' });

    try {
        // Fetch the transaction from Aleo API
        const txUrl = `${ALEO_ENDPOINT}/${ALEO_NETWORK}/transaction/${txId}`;
        console.log('Fetching transaction:', txUrl);

        const fetch = (await import('node-fetch')).default;
        const txRes = await fetch(txUrl);
        if (!txRes.ok) {
            return res.status(404).json({ error: `Transaction not found: ${txRes.status}` });
        }
        const txData = await txRes.json();

        // Extract record ciphertexts from execution transitions
        const transitions = txData?.execution?.transitions || [];
        const records = [];

        for (const transition of transitions) {
            if (transition.program !== ALEO_PROGRAM) continue;

            for (const output of (transition.outputs || [])) {
                if (output.type === 'record' && output.value) {
                    try {
                        const command = `snarkos developer decrypt --ciphertext "${output.value}" --view-key "${vk}"`;
                        const { stdout } = await execAsync(command, { timeout: 30000 });
                        const plaintext = stdout.trim();

                        if (plaintext && plaintext.includes('score')) {
                            records.push({
                                plaintext,
                                ciphertext: output.value,
                                transitionId: transition.id,
                                function: transition.function,
                            });
                        }
                    } catch (decryptErr) {
                        // Not our record or wrong view key — skip
                        console.log('Could not decrypt output:', decryptErr.message?.slice(0, 80));
                    }
                }
            }
        }

        if (records.length === 0) {
            return res.status(404).json({
                error: 'No Credential records found in this transaction (or view key cannot decrypt them).',
                hint: 'Make sure ALEO_VIEW_KEY matches the credential owner.',
            });
        }

        res.json({
            success: true,
            records,
            txId,
        });
    } catch (error) {
        console.error('Fetch credential error:', error);
        res.status(500).json({ error: `Failed to fetch credential: ${error.message}` });
    }
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`TrustLayer Credentials API running on port ${PORT}`);
    console.log(`Aleo Program: ${ALEO_PROGRAM}`);
    console.log(`Aleo Endpoint: ${ALEO_ENDPOINT}`);
    if (hookContract) {
        console.log(`Ethereum Hook: ${HOOK_ADDRESS}`);
    }
});
