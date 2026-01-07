import { useState, useEffect } from 'react';
import { StatusCard, InfoRow, TierBadge, LoadingSpinner } from './StatusCard';
import { getTraderInfo, getTierConfig } from '../utils/api';
import { TIER_NAMES, formatAmount } from '../utils/constants';

export function MyStatus({ address }) {
    const [traderInfo, setTraderInfo] = useState(null);
    const [tierConfig, setTierConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (address) {
            fetchStatus();
        } else {
            setTraderInfo(null);
            setTierConfig(null);
        }
    }, [address]);

    const fetchStatus = async () => {
        setLoading(true);
        setError(null);

        try {
            const info = await getTraderInfo(address);
            setTraderInfo(info);

            if (info.tier > 0) {
                const config = await getTierConfig(info.tier);
                setTierConfig(config);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!address) {
        return (
            <StatusCard title="My Status">
                <p className="muted">Connect your wallet to see your status</p>
            </StatusCard>
        );
    }

    if (loading) {
        return (
            <StatusCard title="My Status">
                <LoadingSpinner />
            </StatusCard>
        );
    }

    if (error) {
        return (
            <StatusCard title="My Status">
                <p className="error">{error}</p>
            </StatusCard>
        );
    }

    if (!traderInfo || !traderInfo.isRegistered) {
        return (
            <StatusCard title="My Status">
                <TierBadge tier={0} tierName="Not Registered" />
                <p className="muted">
                    You are not registered. Ask an issuer to register you after proving your tier on Aleo.
                </p>
            </StatusCard>
        );
    }

    return (
        <StatusCard title="My Status">
            <TierBadge tier={traderInfo.tier} tierName={traderInfo.tierName} />
            
            <div className="status-details">
                <InfoRow label="Address" value={address.slice(0, 10) + '...'} />
                <InfoRow label="Tier" value={traderInfo.tier} />
                <InfoRow 
                    label="Registered Block" 
                    value={traderInfo.registeredAt.toLocaleString()} 
                />
                <InfoRow 
                    label="Expiry Block" 
                    value={traderInfo.expiry.toLocaleString()} 
                />
                
                {tierConfig && (
                    <>
                        <InfoRow 
                            label="Your Fee" 
                            value={`${tierConfig.feePercent}%`} 
                        />
                        <InfoRow 
                            label="Max Trade Size" 
                            value={`${formatAmount(tierConfig.maxTradeSizeFormatted)} tokens`} 
                        />
                        <InfoRow 
                            label="Status" 
                            value={tierConfig.enabled ? 'Active' : 'Disabled'} 
                            variant={tierConfig.enabled ? 'valid' : 'invalid'}
                        />
                    </>
                )}
            </div>

            <button className="btn-refresh" onClick={fetchStatus}>
                Refresh Status
            </button>
        </StatusCard>
    );
}