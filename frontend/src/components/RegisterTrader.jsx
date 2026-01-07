import { useState } from 'react';
import { StatusCard, InfoRow, TierBadge, ErrorMessage, SuccessMessage } from './StatusCard';
import { verifyProof, registerTrader } from '../utils/api';

export function RegisterMe({ address }) {
    const [aleoTxId, setAleoTxId] = useState('');
    const [expiryBlocks, setExpiryBlocks] = useState('100000');
    
    const [proofData, setProofData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleVerifyProof = async () => {
        if (!aleoTxId) return;
        
        setVerifying(true);
        setError(null);
        setProofData(null);

        try {
            const data = await verifyProof(aleoTxId);
            if (data.error) {
                setError(data.error);
            } else {
                setProofData(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setVerifying(false);
        }
    };

    const handleRegister = async () => {
        if (!aleoTxId || !address) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await registerTrader(
                aleoTxId, 
                address,  // Use connected wallet address
                parseInt(expiryBlocks)
            );
            
            if (result.error) {
                setError(result.error);
            } else {
                setSuccess(`Successfully registered as ${result.tierName}! You can now swap on Uniswap.`);
                setProofData(null);
                setAleoTxId('');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!address) {
        return (
            <StatusCard title="Register Me">
                <p className="muted">Connect your ETH wallet first to register for trading access.</p>
            </StatusCard>
        );
    }

    return (
        <StatusCard title="Register Me">
            <p className="description">
                Link your Aleo credential proof to your ETH wallet to enable trading on Uniswap.
            </p>

            <div className="register-steps">
                <div className="step">
                    <span className="step-number">1</span>
                    <span>Prove your tier on Aleo (using Leo/Aleo wallet)</span>
                </div>
                <div className="step">
                    <span className="step-number">2</span>
                    <span>Enter the Aleo transaction ID below</span>
                </div>
                <div className="step">
                    <span className="step-number">3</span>
                    <span>Register your connected ETH wallet</span>
                </div>
            </div>

            <div className="connected-wallet">
                <span className="label">Your ETH Wallet:</span>
                <span className="address">{address}</span>
            </div>

            <div className="form-group">
                <label>Aleo prove_tier Transaction ID</label>
                <input
                    type="text"
                    placeholder="at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar..."
                    value={aleoTxId}
                    onChange={(e) => setAleoTxId(e.target.value)}
                />
                <button 
                    className="btn-secondary"
                    onClick={handleVerifyProof}
                    disabled={!aleoTxId || verifying}
                >
                    {verifying ? 'Verifying...' : 'Verify Proof'}
                </button>
            </div>

            {proofData && (
                <div className="proof-result">
                    <h3>Proof Verified ✓</h3>
                    <TierBadge tier={proofData.tier} tierName={proofData.tierName} />
                    <InfoRow label="Commitment" value={proofData.commitment?.slice(0, 20) + '...'} />
                    <InfoRow 
                        label="Issued" 
                        value={proofData.wasIssued ? 'Yes' : 'No'} 
                        variant={proofData.wasIssued ? 'valid' : 'invalid'}
                    />
                    <InfoRow 
                        label="Revoked" 
                        value={proofData.isRevoked ? 'Yes' : 'No'} 
                        variant={proofData.isRevoked ? 'invalid' : 'valid'}
                    />
                    <InfoRow 
                        label="Valid" 
                        value={proofData.isValid ? 'Yes' : 'No'} 
                        variant={proofData.isValid ? 'valid' : 'invalid'}
                    />
                </div>
            )}

            {proofData && !proofData.isValid && (
                <ErrorMessage message="This credential is not valid. It may have been revoked or not issued properly." />
            )}

            {proofData?.isValid && (
                <>
                    <div className="form-group">
                        <label>Registration Duration (blocks)</label>
                        <input
                            type="number"
                            value={expiryBlocks}
                            onChange={(e) => setExpiryBlocks(e.target.value)}
                        />
                        <span className="hint">~100,000 blocks ≈ 2 weeks on Ethereum</span>
                    </div>

                    <button 
                        className="btn-primary"
                        onClick={handleRegister}
                        disabled={loading}
                    >
                        {loading ? 'Registering...' : `Register as ${proofData.tierName}`}
                    </button>
                </>
            )}

            <ErrorMessage message={error} />
            <SuccessMessage message={success} />
        </StatusCard>
    );
}
