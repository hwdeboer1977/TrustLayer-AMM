import { useState, useEffect } from 'react';
import { getTraderInfo, getTierConfig } from '../utils/api';
import { TIER_INFO } from '../abis/contracts';

export default function MyStatus({ address }) {
  const [trader, setTrader] = useState(null);
  const [tierConfig, setTierConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;
    fetchStatus();
  }, [address]);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await getTraderInfo(address);
      setTrader(info);
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
      <div className="panel panel-empty">
        <div className="empty-icon">🔗</div>
        <p>Connect your wallet to view your trading status</p>
      </div>
    );
  }

  if (loading) {
    return <div className="panel panel-loading"><div className="spinner" /> Loading status...</div>;
  }

  if (error) {
    return (
      <div className="panel panel-error">
        <p>⚠️ {error}</p>
        <button className="btn btn-sm" onClick={fetchStatus}>Retry</button>
      </div>
    );
  }

  const tier = trader?.tier || 0;
  const meta = TIER_INFO[tier] || TIER_INFO[0];

  return (
    <div className="panel">
      <div className="status-card">
        <div className="tier-badge" style={{ '--tier-color': meta.color }}>
          <span className="tier-level">{tier === 0 ? '?' : tier}</span>
          <span className="tier-name">{meta.name}</span>
          <span className="tier-label">{meta.label}</span>
        </div>

        <div className="status-details">
          <div className="detail-row">
            <span className="detail-label">Address</span>
            <span className="detail-value mono">{address}</span>
          </div>
          {tier > 0 && (
            <>
              <div className="detail-row">
                <span className="detail-label">Trading Fee</span>
                <span className="detail-value highlight">{meta.fee}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Max Trade Size</span>
                <span className="detail-value">{tierConfig?.maxTradeSizeFormatted || meta.maxTrade} tokens</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Registered At Block</span>
                <span className="detail-value">{trader?.registeredAt?.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Expires At Block</span>
                <span className="detail-value">{trader?.expiry?.toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Commitment</span>
                <span className="detail-value mono small">{trader?.commitment}</span>
              </div>
            </>
          )}
          {tier === 0 && (
            <div className="unregistered-notice">
              <p>You are not registered as a trader yet.</p>
              <p>Go to the <strong>Register</strong> tab to submit your Aleo ZK proof and get trading access.</p>
            </div>
          )}
        </div>
      </div>

      <button className="btn btn-sm btn-ghost" onClick={fetchStatus} style={{ marginTop: '1rem' }}>
        ↻ Refresh
      </button>
    </div>
  );
}
