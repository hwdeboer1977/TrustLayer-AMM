import { useState } from 'react';
import { StatusCard, InfoRow, TierBadge, ErrorMessage } from './StatusCard';
import { verifyProof } from '../utils/api';

export function VerifyProof() {
    const [txId, setTxId] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!txId) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await verifyProof(txId);
            if (data.error) {
                setError(data.error);
            } else {
                setResult(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <StatusCard title="Verify Aleo Proof">
            <p className="description">
                Enter a prove_tier transaction ID to verify the credential and see the tier.
            </p>

            <form onSubmit={handleVerify}>
                <div className="form-group">
                    <label>Transaction ID</label>
                    <input
                        type="text"
                        placeholder="at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke"
                        value={txId}
                        onChange={(e) => setTxId(e.target.value)}
                    />
                </div>
                <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={loading || !txId}
                >
                    {loading ? 'Verifying...' : 'Verify Proof'}
                </button>
            </form>

            {result && (
                <div className={`result ${result.isValid ? 'success' : 'error'}`}>
                    <h3>{result.isValid ? '✓ Valid Credential' : '✗ Invalid Credential'}</h3>
                    
                    <TierBadge tier={result.tier} tierName={result.tierName} />
                    
                    <InfoRow label="Tier" value={result.tier} />
                    <InfoRow 
                        label="Commitment" 
                        value={result.commitment?.slice(0, 20) + '...'} 
                    />
                    <InfoRow 
                        label="Was Issued" 
                        value={result.wasIssued ? 'Yes' : 'No'} 
                        variant={result.wasIssued ? 'valid' : 'invalid'}
                    />
                    <InfoRow 
                        label="Is Revoked" 
                        value={result.isRevoked ? 'Yes' : 'No'} 
                        variant={result.isRevoked ? 'invalid' : 'valid'}
                    />
                    <InfoRow 
                        label="Block Checked" 
                        value={result.currentBlock} 
                    />
                </div>
            )}

            <ErrorMessage message={error} />
        </StatusCard>
    );
}