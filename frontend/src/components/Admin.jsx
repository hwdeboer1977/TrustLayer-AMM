import { useState, useEffect } from 'react';
import {
  getHookInfo,
  getTierConfig,
  revokeTrader,
  issueCredential,
  addIssuer,
  removeIssuer,
  revokeCredential,
  checkIssuer,
  checkCredential,
} from '../utils/api';

// ============ Issue Credential Section ============

function IssueCredentialSection() {
  const [recipient, setRecipient] = useState('');
  const [score, setScore] = useState('');
  const [expiry, setExpiry] = useState('');
  const [nonce, setNonce] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generateNonce = () => {
    const rand = BigInt(Math.floor(Math.random() * 2 ** 64));
    setNonce(rand.toString() + 'field');
  };

  const tierFromScore = (s) => {
    const n = parseInt(s);
    if (n >= 800) return { tier: 3, name: 'Tier A (Whale)', color: '#10b981' };
    if (n >= 700) return { tier: 2, name: 'Tier B (Pro)', color: '#3b82f6' };
    if (n >= 600) return { tier: 1, name: 'Tier C (Basic)', color: '#f59e0b' };
    return { tier: 0, name: 'Ineligible', color: '#ef4444' };
  };

  const currentTier = score ? tierFromScore(score) : null;

  const handleIssue = async () => {
    if (!recipient || !score || !expiry || !nonce) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await issueCredential(recipient, parseInt(score), parseInt(expiry), nonce);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <h4>📋 Issue Credential</h4>
      <p className="section-desc">
        Create a ZK credential for a user on Aleo. The score is private — only the tier is provable.
      </p>

      <div className="form-grid-2col">
        <div className="form-group">
          <label>Recipient Aleo Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="aleo1..."
            className="input mono"
          />
        </div>

        <div className="form-group">
          <label>
            Credit Score (0–1000)
            {currentTier && (
              <span className="score-tier-badge" style={{ backgroundColor: currentTier.color }}>
                → {currentTier.name}
              </span>
            )}
          </label>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="750"
            min="0"
            max="1000"
            className="input"
          />
          <div className="score-bar">
            <div className="score-range range-ineligible" />
            <div className="score-range range-basic" />
            <div className="score-range range-pro" />
            <div className="score-range range-whale" />
          </div>
          <div className="score-labels">
            <span>0</span><span>600</span><span>700</span><span>800</span><span>1000</span>
          </div>
        </div>

        <div className="form-group">
          <label>Expiry (Aleo block height)</label>
          <input
            type="number"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="500000"
            className="input"
          />
          <span className="hint">Block height when credential expires on Aleo</span>
        </div>

        <div className="form-group">
          <label>Nonce (unique per credential)</label>
          <div className="input-with-button">
            <input
              type="text"
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              placeholder="12345field"
              className="input mono"
            />
            <button className="btn btn-sm btn-ghost" onClick={generateNonce} type="button">
              🎲 Generate
            </button>
          </div>
          <span className="hint">Used to derive commitment hash via BHP256</span>
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg"
        onClick={handleIssue}
        disabled={loading || !recipient || !score || !expiry || !nonce}
      >
        {loading ? '⏳ Issuing on Aleo...' : '📝 Issue Credential'}
      </button>

      {result && (
        <div className={`result-box ${result.error ? 'result-error' : 'result-success'}`}>
          {result.error ? (
            <>
              <strong>❌ Issue Failed</strong>
              <p>{result.error}</p>
            </>
          ) : (
            <>
              <strong>✅ Credential Issued</strong>
              <div className="result-details">
                {result.txId && <div><span>Aleo TX:</span> <span className="mono">{result.txId}</span></div>}
                <div><span>Recipient:</span> <span className="mono small">{recipient}</span></div>
                <div><span>Tier:</span> <strong>{currentTier?.name}</strong></div>
              </div>
              <div className="instruction-box">
                <strong>Next:</strong> The user now holds a private Credential record.
                They call <code>prove_tier</code> on Aleo to get a ZK proof TX ID, then register their ETH wallet in the Register tab.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Manage Issuers Section ============

function ManageIssuersSection() {
  const [issuerAddr, setIssuerAddr] = useState('');
  const [checkAddr, setCheckAddr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [checkResult, setCheckResult] = useState(null);

  const handleAdd = async () => {
    if (!issuerAddr) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await addIssuer(issuerAddr);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!issuerAddr) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await removeIssuer(issuerAddr);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    if (!checkAddr) return;
    try {
      const res = await checkIssuer(checkAddr);
      setCheckResult(res);
    } catch (err) {
      setCheckResult({ error: err.message });
    }
  };

  return (
    <div className="admin-section">
      <h4>👥 Manage Issuers</h4>
      <p className="section-desc">
        Approve or remove addresses that can issue credentials on Aleo. Admin only.
      </p>

      <div className="form-group">
        <label>Issuer Aleo Address</label>
        <input type="text" value={issuerAddr} onChange={(e) => setIssuerAddr(e.target.value)} placeholder="aleo1..." className="input mono" />
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleAdd} disabled={loading || !issuerAddr}>
          ✅ Approve Issuer
        </button>
        <button className="btn btn-danger" onClick={handleRemove} disabled={loading || !issuerAddr}>
          🚫 Remove Issuer
        </button>
      </div>

      {result && (
        <div className={`result-box ${result.error ? 'result-error' : 'result-success'}`}>
          {result.error ? `❌ ${result.error}` : `✅ ${result.message || 'Success'}`}
        </div>
      )}

      <div className="divider" />

      <h4>🔍 Check Issuer Status</h4>
      <div className="form-group">
        <label>Aleo Address</label>
        <div className="input-with-button">
          <input type="text" value={checkAddr} onChange={(e) => setCheckAddr(e.target.value)} placeholder="aleo1..." className="input mono" />
          <button className="btn btn-sm" onClick={handleCheck} disabled={!checkAddr}>Check</button>
        </div>
      </div>
      {checkResult && (
        <div className={`result-box ${checkResult.isApproved ? 'result-success' : 'result-warning'}`}>
          {checkResult.isApproved ? '✅ Approved issuer' : '⚠️ Not an approved issuer'}
        </div>
      )}
    </div>
  );
}

// ============ Revoke Credential Section (Aleo) ============

function RevokeCredentialSection() {
  const [commitment, setCommitment] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [revokeResult, setRevokeResult] = useState(null);

  const handleVerify = async () => {
    if (!commitment) return;
    setVerifyResult(null);
    try {
      const res = await checkCredential(commitment);
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ error: err.message });
    }
  };

  const handleRevoke = async () => {
    if (!commitment) return;
    setLoading(true);
    setRevokeResult(null);
    try {
      const res = await revokeCredential(commitment);
      setRevokeResult(res);
    } catch (err) {
      setRevokeResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <h4>📄 Revoke Credential (Aleo)</h4>
      <p className="section-desc">
        Check credential status or revoke by commitment hash on the Aleo chain.
      </p>

      <div className="form-group">
        <label>Credential Commitment</label>
        <input type="text" value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="12345field" className="input mono" />
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleVerify} disabled={!commitment}>
          🔍 Verify Status
        </button>
        <button className="btn btn-danger" onClick={handleRevoke} disabled={loading || !commitment}>
          {loading ? '⏳ Revoking...' : '🚫 Revoke on Aleo'}
        </button>
      </div>

      {verifyResult && !verifyResult.error && (
        <div className={`result-box ${verifyResult.isValid ? 'result-success' : 'result-warning'}`}>
          <div className="result-details">
            <div><span>Issued:</span> {verifyResult.wasIssued ? '✅ Yes' : '❌ No'}</div>
            <div><span>Revoked:</span> {verifyResult.isRevoked ? '🚫 Yes' : '✅ No'}</div>
            <div><span>Valid:</span> {verifyResult.isValid ? '✅ Active' : '⚠️ Invalid'}</div>
          </div>
        </div>
      )}

      {revokeResult && (
        <div className={`result-box ${revokeResult.error ? 'result-error' : 'result-success'}`}>
          {revokeResult.error ? `❌ ${revokeResult.error}` : `✅ ${revokeResult.message || 'Credential revoked'}`}
        </div>
      )}
    </div>
  );
}

// ============ Main Admin Component ============

export default function Admin() {
  const [hookInfo, setHookInfo] = useState(null);
  const [tierConfigs, setTierConfigs] = useState({});
  const [revokeAddress, setRevokeAddress] = useState('');
  const [revokeCommitment, setRevokeCommitment] = useState('');
  const [loading, setLoading] = useState(false);
  const [revokeResult, setRevokeResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('issue');

  useEffect(() => {
    fetchHookData();
  }, []);

  const fetchHookData = async () => {
    setLoading(true);
    try {
      const [info, t1, t2, t3] = await Promise.all([
        getHookInfo(),
        getTierConfig(1),
        getTierConfig(2),
        getTierConfig(3),
      ]);
      setHookInfo(info);
      setTierConfigs({ 1: t1, 2: t2, 3: t3 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeTrader = async () => {
    if (!revokeAddress) return;
    setLoading(true);
    setRevokeResult(null);
    try {
      const res = await revokeTrader(revokeAddress, revokeCommitment || undefined);
      setRevokeResult(res);
    } catch (err) {
      setRevokeResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'issue', label: 'Issue Credential', icon: '📋' },
    { id: 'issuers', label: 'Manage Issuers', icon: '👥' },
    { id: 'revoke-aleo', label: 'Revoke Credential', icon: '📄' },
    { id: 'hook', label: 'Hook Config', icon: '⛓️' },
    { id: 'revoke-eth', label: 'Revoke Trader (ETH)', icon: '🚫' },
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>⚙️ Administration</h3>
        <p className="panel-desc">
          Issue credentials on Aleo, manage issuers, view hook config, and revoke access.
        </p>
      </div>

      <nav className="sub-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`sub-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </nav>

      <div className="sub-tab-content">
        {activeSection === 'issue' && <IssueCredentialSection />}
        {activeSection === 'issuers' && <ManageIssuersSection />}
        {activeSection === 'revoke-aleo' && <RevokeCredentialSection />}

        {activeSection === 'hook' && (
          <div className="admin-section">
            <h4>⛓️ Hook Configuration</h4>

            {hookInfo && (
              <div className="info-grid">
                <div className="info-card">
                  <span className="info-label">Hook Address</span>
                  <span className="info-value mono small">{hookInfo.hookAddress}</span>
                </div>
                <div className="info-card">
                  <span className="info-label">Admin</span>
                  <span className="info-value mono small">{hookInfo.admin}</span>
                </div>
                <div className="info-card">
                  <span className="info-label">Relayer</span>
                  <span className="info-value mono small">{hookInfo.relayer}</span>
                </div>
              </div>
            )}

            <h4 style={{ marginTop: '1.5rem' }}>Tier Configurations</h4>
            <div className="tier-grid">
              {[1, 2, 3].map((t) => {
                const cfg = tierConfigs[t];
                if (!cfg) return null;
                return (
                  <div key={t} className="tier-config-card">
                    <div className="tier-config-header">Tier {t}</div>
                    <div className="tier-config-row"><span>Fee</span><span>{cfg.feePercent}%</span></div>
                    <div className="tier-config-row"><span>Max Trade</span><span>{cfg.maxTradeSizeFormatted} tokens</span></div>
                    <div className="tier-config-row"><span>Enabled</span><span>{cfg.enabled ? '✅' : '❌'}</span></div>
                  </div>
                );
              })}
            </div>

            <button className="btn btn-sm btn-ghost" onClick={fetchHookData} style={{ marginTop: '1rem' }}>
              ↻ Refresh
            </button>
          </div>
        )}

        {activeSection === 'revoke-eth' && (
          <div className="admin-section">
            <h4>🚫 Revoke Trader (ETH Hook)</h4>
            <p className="section-desc">
              Remove a trader's registration from the Uniswap V4 hook on Ethereum.
            </p>

            <div className="form-group">
              <label>ETH Address</label>
              <input type="text" value={revokeAddress} onChange={(e) => setRevokeAddress(e.target.value)} placeholder="0x..." className="input mono" />
            </div>
            <div className="form-group">
              <label>Aleo Commitment (optional)</label>
              <input type="text" value={revokeCommitment} onChange={(e) => setRevokeCommitment(e.target.value)} placeholder="12345field" className="input mono" />
              <span className="hint">If provided, checks revocation on Aleo first</span>
            </div>
            <button className="btn btn-danger" onClick={handleRevokeTrader} disabled={loading || !revokeAddress}>
              {loading ? '⏳ Revoking...' : '🚫 Revoke Trader'}
            </button>

            {revokeResult && (
              <div className={`result-box ${revokeResult.error ? 'result-error' : 'result-success'}`}>
                {revokeResult.error ? `❌ ${revokeResult.error}` : `✅ ${revokeResult.message}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
