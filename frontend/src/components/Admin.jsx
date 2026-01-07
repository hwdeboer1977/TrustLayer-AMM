import { useState, useEffect } from 'react';
import { StatusCard, InfoRow, ErrorMessage, SuccessMessage, LoadingSpinner } from './StatusCard';
import { getHookInfo, revokeTrader, getTraderInfo } from '../utils/api';
import { formatAddress } from '../utils/constants';

export function Admin() {
    const [hookInfo, setHookInfo] = useState(null);
    const [revokeAddress, setRevokeAddress] = useState('');
    const [lookupAddress, setLookupAddress] = useState('');
    const [lookupResult, setLookupResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        fetchHookInfo();
    }, []);

    const fetchHookInfo = async () => {
        try {
            const info = await getHookInfo();
            setHookInfo(info);
        } catch (err) {
            console.error('Failed to fetch hook info:', err);
        }
    };

    const handleRevoke = async () => {
        if (!revokeAddress) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await revokeTrader(revokeAddress);
            if (result.error) {
                setError(result.error);
            } else {
                setSuccess(`Trader revoked! TX: ${result.ethTxHash}`);
                setRevokeAddress('');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLookup = async () => {
        if (!lookupAddress) return;

        try {
            const result = await getTraderInfo(lookupAddress);
            setLookupResult(result);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="admin-panel">
            <StatusCard title="Hook Info">
                {hookInfo ? (
                    <>
                        <InfoRow label="Hook Address" value={formatAddress(hookInfo.hookAddress)} />
                        <InfoRow label="Admin" value={formatAddress(hookInfo.admin)} />
                        <InfoRow label="Relayer" value={formatAddress(hookInfo.relayer)} />
                        <InfoRow label="Configured Relayer" value={formatAddress(hookInfo.relayerConfigured)} />
                    </>
                ) : (
                    <LoadingSpinner />
                )}
            </StatusCard>

            <StatusCard title="Lookup Trader">
                <div className="form-group">
                    <label>Ethereum Address</label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={lookupAddress}
                        onChange={(e) => setLookupAddress(e.target.value)}
                    />
                    <button 
                        className="btn-secondary"
                        onClick={handleLookup}
                        disabled={!lookupAddress}
                    >
                        Lookup
                    </button>
                </div>

                {lookupResult && (
                    <div className="lookup-result">
                        <InfoRow label="Address" value={formatAddress(lookupResult.address)} />
                        <InfoRow label="Tier" value={lookupResult.tierName} />
                        <InfoRow 
                            label="Registered" 
                            value={lookupResult.isRegistered ? 'Yes' : 'No'} 
                            variant={lookupResult.isRegistered ? 'valid' : 'invalid'}
                        />
                        {lookupResult.isRegistered && (
                            <>
                                <InfoRow label="Expiry Block" value={lookupResult.expiry} />
                                <InfoRow 
                                    label="Commitment" 
                                    value={lookupResult.commitment?.slice(0, 18) + '...'} 
                                />
                            </>
                        )}
                    </div>
                )}
            </StatusCard>

            <StatusCard title="Revoke Trader">
                <p className="description warning">
                    ⚠️ This will permanently remove the trader's access until re-registered.
                </p>

                <div className="form-group">
                    <label>Ethereum Address to Revoke</label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={revokeAddress}
                        onChange={(e) => setRevokeAddress(e.target.value)}
                    />
                </div>

                <button 
                    className="btn-danger"
                    onClick={handleRevoke}
                    disabled={!revokeAddress || loading}
                >
                    {loading ? 'Revoking...' : 'Revoke Trader'}
                </button>

                <ErrorMessage message={error} />
                <SuccessMessage message={success} />
            </StatusCard>
        </div>
    );
}