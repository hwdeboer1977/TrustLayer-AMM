import { useState } from 'react';
import { verifyProof } from '../utils/api';
import { TIER_INFO } from '../abis/contracts';

export default function VerifyProof() {
  const [txId, setTxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    if (!txId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await verifyProof(txId);
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

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Verify ZK Proof</h3>
        <p className="panel-desc">Check any Aleo prove_tier transaction to see the tier and validity</p>
      </div>

      <div className="form-section">
        <div className="form-group">
          <label>Aleo Transaction ID</label>
          <input
            type="text"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="at1..."
            className="input mono"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleVerify}
          disabled={loading || !txId}
        >
          {loading ? '⏳ Verifying...' : '🔍 Verify Proof'}
        </button>
      </div>

      {error && (
        <div className="result-box result-error">
          <strong>❌ Verification Failed</strong>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className={`result-box ${result.isValid ? 'result-success' : 'result-warning'}`}>
          <strong>{result.isValid ? '✅' : '⚠️'} {result.message}</strong>
          <div className="result-details">
            <div>
              <span>Tier:</span>
              <strong style={{ color: TIER_INFO[result.tier]?.color }}>
                {result.tier} — {result.tierName}
              </strong>
            </div>
            <div><span>Commitment:</span> <span className="mono small">{result.commitment}</span></div>
            <div><span>Block Used:</span> {result.currentBlock}</div>
            <div><span>Issued On-Chain:</span> {result.wasIssued ? '✅ Yes' : '❌ No'}</div>
            <div><span>Revoked:</span> {result.isRevoked ? '🚫 Yes' : '✅ No'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
