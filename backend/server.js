const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
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

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`TrustLayer Credentials API running on port ${PORT}`);
    console.log(`Aleo Program: ${ALEO_PROGRAM}`);
    console.log(`Aleo Endpoint: ${ALEO_ENDPOINT}`);
    if (hookContract) {
        console.log(`Ethereum Hook: ${HOOK_ADDRESS}`);
    }
});
