import { useState } from 'react';
import { registerTrader } from '../utils/api';

export default function RegisterMe({ address }) {
  const [aleoTxId, setAleoTxId] = useState('');
  const [expiryBlocks, setExpiryBlocks] = useState('100000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRegister = async () => {
    if (!address || !aleoTxId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await registerTrader(aleoTxId, address, parseInt(expiryBlocks));
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
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
        <p>Connect your wallet first to register as a trader</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Register as Trader</h3>
        <p className="panel-desc">Submit your Aleo prove_tier TX ID to get trading access on Uniswap V4</p>
      </div>

      <div className="form-section">
        <div className="flow-diagram-mini">
          <span>🔐 Aleo Proof</span>
          <span className="arrow">→</span>
          <span>🔍 Verify</span>
          <span className="arrow">→</span>
          <span>✅ Register on ETH</span>
        </div>

        <div className="form-group">
          <label>Your ETH Address</label>
          <input type="text" value={address} disabled className="input mono" />
        </div>

        <div className="form-group">
          <label>Aleo prove_tier Transaction ID</label>
          <input
            type="text"
            value={aleoTxId}
            onChange={(e) => setAleoTxId(e.target.value)}
            placeholder="at1..."
            className="input mono"
          />
          <span className="hint">The TX ID from your prove_tier call on Aleo testnet</span>
        </div>

        <div className="form-group">
          <label>Expiry (blocks from now)</label>
          <input
            type="number"
            value={expiryBlocks}
            onChange={(e) => setExpiryBlocks(e.target.value)}
            className="input"
          />
          <span className="hint">How many ETH blocks until your registration expires (~100K ≈ 3.5 days)</span>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleRegister}
          disabled={loading || !aleoTxId}
        >
          {loading ? '⏳ Verifying & Registering...' : '🔗 Register My Wallet'}
        </button>
      </div>

      {error && (
        <div className="result-box result-error">
          <strong>❌ Registration Failed</strong>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="result-box result-success">
          <strong>✅ {result.message}</strong>
          <div className="result-details">
            <div><span>Tier:</span> <strong>{result.tierName}</strong></div>
            <div><span>ETH TX:</span> <a href={`https://sepolia.arbiscan.io/tx/${result.ethTxHash}`} target="_blank" rel="noreferrer" className="mono">{result.ethTxHash?.slice(0, 18)}...</a></div>
            <div><span>Aleo TX:</span> <span className="mono">{result.aleoTxId?.slice(0, 18)}...</span></div>
            <div><span>Expires at block:</span> {result.expiry?.toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
