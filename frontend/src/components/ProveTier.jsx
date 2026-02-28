import { useState, useCallback } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import {
  Transaction,
  WalletAdapterNetwork,
  WalletNotConnectedError,
} from '@demox-labs/aleo-wallet-adapter-base';
import { getBlockHeight, fetchCredentialFromTx, proveTierBackend } from '../utils/api';

const PROGRAM_ID = 'trustlayer_credentials_amm_v2.aleo';

export default function ProveTier() {
  const {
    publicKey,
    requestRecordPlaintexts,
    requestExecution,
    transactionStatus,
    connected,
  } = useWallet();

  // State
  const [credentials, setCredentials] = useState([]);
  const [selectedCred, setSelectedCred] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingRecords, setFetchingRecords] = useState(false);
  const [txId, setTxId] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [error, setError] = useState(null);
  const [blockHeight, setBlockHeight] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualRecord, setManualRecord] = useState('');
  const [issueTxId, setIssueTxId] = useState('');
  const [fetchingFromTx, setFetchingFromTx] = useState(false);

  // ============ Fetch Credential from Issue TX ID (via backend decrypt) ============
  const fetchFromTxId = useCallback(async () => {
    if (!issueTxId.trim()) return;
    setFetchingFromTx(true);
    setError(null);

    try {
      const result = await fetchCredentialFromTx(issueTxId.trim());

      if (result.error) {
        setError(result.error + (result.hint ? ` ${result.hint}` : ''));
        setShowManualInput(true);
        return;
      }

      if (result.records && result.records.length > 0) {
        // Convert backend results to credential objects
        const creds = result.records.map((r) => ({
          plaintext: r.plaintext,
          ciphertext: r.ciphertext,
          recordName: 'Credential',
        }));
        setCredentials(creds);
        setSelectedCred(creds[0]); // Auto-select first
      }
    } catch (err) {
      console.error('Fetch from TX error:', err);
      setError(`Failed to fetch credential from TX: ${err.message}`);
    } finally {
      setFetchingFromTx(false);
    }
  }, [issueTxId]);

  // ============ Fetch Credential Records ============
  const fetchCredentials = useCallback(async () => {
    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    setFetchingRecords(true);
    setError(null);
    setCredentials([]);

    try {
      let records = [];

      // Try multiple approaches - Leo Wallet permission model varies by version
      // Approach 1: requestRecords (doesn't require decrypt permission)
      if (requestRecordPlaintexts) {
        try {
          records = await requestRecordPlaintexts(PROGRAM_ID);
        } catch (e1) {
          console.warn('requestRecordPlaintexts failed, trying direct provider:', e1.message);

          // Approach 2: Direct Leo Wallet provider API
          const leoProvider = window.leoWallet || window.leo;
          if (leoProvider && leoProvider.requestRecordPlaintexts) {
            try {
              const result = await leoProvider.requestRecordPlaintexts(PROGRAM_ID);
              records = result?.records || result || [];
            } catch (e2) {
              console.warn('Direct provider also failed:', e2.message);

              // Approach 3: requestRecords (encrypted, less useful but won't fail on permissions)
              if (requestRecordPlaintexts) {
                // If all record fetching fails, suggest manual input
                throw e1;
              }
            }
          } else {
            throw e1;
          }
        }
      }

      // Filter for unspent Credential records
      const creds = (records || []).filter(
        (r) => !r.spent && (r.recordName === 'Credential' || r.plaintext?.includes('score') || r.data)
      );

      setCredentials(creds);

      if (creds.length === 0) {
        setError('No unspent Credential records found. Make sure Leo Wallet is fully synced and the credential was issued to this address.');
      }
    } catch (err) {
      console.error('Fetch credentials error:', err);
      // Show helpful message with manual fallback
      setError(
        `Leo Wallet denied record access (${err.message}). Try: 1) Open Leo Wallet extension → Settings → Connected Sites → Remove localhost → Reconnect. 2) Or use manual input below.`
      );
      setShowManualInput(true);
    } finally {
      setFetchingRecords(false);
    }
  }, [publicKey, requestRecordPlaintexts]);

  // ============ Execute prove_tier via backend ============
  const handleProveTier = useCallback(async () => {
    // Get credential plaintext from either selected record or manual input
    let credPlaintext;
    if (selectedCred) {
      credPlaintext = selectedCred.plaintext || JSON.stringify(selectedCred.data);
    } else if (manualRecord.trim()) {
      credPlaintext = manualRecord.trim();
    } else {
      setError('Select a credential or paste a record plaintext');
      return;
    }

    setLoading(true);
    setError(null);
    setTxId(null);
    setTxStatus(null);

    try {
      setTxStatus('Generating ZK proof on Aleo (this may take 1-3 minutes)...');

      const result = await proveTierBackend(credPlaintext);

      if (result.error) {
        setError(result.error + (result.hint ? ` ${result.hint}` : ''));
        setTxStatus(null);
        return;
      }

      setTxId(result.txId);
      setBlockHeight(result.blockHeight);
      setTxStatus('✅ Accepted — proof broadcast to Aleo network');
    } catch (err) {
      console.error('prove_tier error:', err);
      setError(`Failed to execute prove_tier: ${err.message || err}`);
      setTxStatus(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCred, manualRecord]);

  // ============ Parse credential display info ============
  const parseCredInfo = (cred) => {
    try {
      const plaintext = cred.plaintext || '';
      const scoreMatch = plaintext.match(/score:\s*(\d+)u16/);
      const expiryMatch = plaintext.match(/expiry:\s*(\d+)u32/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : '?';
      const expiry = expiryMatch ? parseInt(expiryMatch[1]) : '?';

      let tier = '?';
      if (typeof score === 'number') {
        if (score >= 800) tier = '3 (Whale)';
        else if (score >= 700) tier = '2 (Pro)';
        else if (score >= 600) tier = '1 (Basic)';
        else tier = '0 (Ineligible)';
      }

      return { score, expiry, tier };
    } catch {
      return { score: '?', expiry: '?', tier: '?' };
    }
  };

  // ============ Render ============
  if (!connected) {
    return (
      <div className="panel panel-empty">
        <div className="empty-icon">🦁</div>
        <p>Connect your Leo Wallet to prove your tier</p>
        <span className="hint">Use the Aleo wallet button in the header to connect</span>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>🔐 Prove Your Tier</h3>
        <p className="panel-desc">
          Fetch your private Credential record from Leo Wallet, then execute <code>prove_tier</code> to
          generate a ZK proof of your tier without revealing your credit score.
        </p>
      </div>

      {/* Step 1: Fetch credentials */}
      <div className="prove-step">
        <div className="prove-step-header">
          <span className="prove-step-num">1</span>
          <h4>Load Your Credential</h4>
        </div>

        {/* Primary method: Fetch from Issue TX ID */}
        <p className="section-desc">
          Paste the TX ID from when your credential was issued. The backend will fetch and decrypt it.
        </p>
        <div className="form-group">
          <label>Issue Transaction ID</label>
          <div className="input-with-button">
            <input
              type="text"
              value={issueTxId}
              onChange={(e) => setIssueTxId(e.target.value)}
              placeholder="at1..."
              className="input mono"
            />
            <button
              className="btn btn-primary"
              onClick={fetchFromTxId}
              disabled={fetchingFromTx || !issueTxId.trim()}
            >
              {fetchingFromTx ? '⏳ Decrypting...' : '🔓 Fetch & Decrypt'}
            </button>
          </div>
          <span className="hint">The TX ID from Admin → Issue Credential</span>
        </div>

        <div className="divider" style={{ margin: '1rem 0' }} />

        {/* Secondary: Leo Wallet fetch */}
        <p className="section-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Or try fetching directly from Leo Wallet (requires decrypt permission):
        </p>
        <button
          className="btn btn-sm btn-ghost"
          onClick={fetchCredentials}
          disabled={fetchingRecords}
        >
          {fetchingRecords ? '⏳ Scanning...' : '🦁 Fetch from Leo Wallet'}
        </button>

        {credentials.length > 0 && (
          <div className="credential-list">
            {credentials.map((cred, idx) => {
              const info = parseCredInfo(cred);
              const isSelected = selectedCred === cred;
              return (
                <button
                  key={idx}
                  className={`credential-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedCred(cred)}
                >
                  <div className="cred-header">
                    <span className="cred-label">Credential #{idx + 1}</span>
                    {isSelected && <span className="cred-selected-badge">Selected</span>}
                  </div>
                  <div className="cred-details">
                    <div><span>Score:</span> <strong>{info.score}</strong></div>
                    <div><span>Tier:</span> <strong>{info.tier}</strong></div>
                    <div><span>Expires:</span> block {info.expiry}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual input fallback */}
      {showManualInput && (
        <div className="prove-step">
          <div className="prove-step-header">
            <span className="prove-step-num">✎</span>
            <h4>Manual Record Input</h4>
          </div>
          <p className="section-desc">
            If Leo Wallet can't fetch records, paste your Credential record plaintext directly.
            You can find it in your Leo Wallet under Activity, or from the <code>leo run</code> output.
          </p>
          <div className="form-group">
            <label>Credential Record Plaintext</label>
            <textarea
              value={manualRecord}
              onChange={(e) => setManualRecord(e.target.value)}
              placeholder={`{\n  owner: aleo1...,\n  score: 800u16,\n  expiry: 500000u32,\n  issuer: aleo1...,\n  nonce: 12345field\n}`}
              className="input mono"
              rows={6}
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
            />
            <span className="hint">Paste the full record object including curly braces</span>
          </div>
        </div>
      )}

      {!showManualInput && credentials.length === 0 && !fetchingRecords && !error && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setShowManualInput(true)}
          style={{ marginTop: '0.5rem' }}
        >
          Or enter record manually...
        </button>
      )}

      {/* Step 2: Execute prove_tier */}
      {(credentials.length > 0 || manualRecord.trim()) && (
        <div className="prove-step">
          <div className="prove-step-header">
            <span className="prove-step-num">2</span>
            <h4>Generate ZK Proof</h4>
          </div>
          <p className="section-desc">
            This executes <code>prove_tier</code> on Aleo. Your wallet will generate the ZK proof locally —
            only the tier number is revealed publicly, not your score.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleProveTier}
            disabled={loading || (!selectedCred && !manualRecord.trim())}
          >
            {loading ? '⏳ Generating ZK proof...' : '🔐 Prove My Tier'}
          </button>
          {!selectedCred && !manualRecord.trim() && (
            <span className="hint">Select a credential above or paste a record manually</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="result-box result-error">
          <strong>❌ Error</strong>
          <p>{error}</p>
        </div>
      )}

      {/* Success */}
      {txId && (
        <div className="prove-step">
          <div className="prove-step-header">
            <span className="prove-step-num">3</span>
            <h4>Registration Ready</h4>
          </div>
          <div className="result-box result-success">
            <strong>✅ ZK Proof Submitted!</strong>
            <div className="result-details">
              <div><span>TX ID:</span> <span className="mono small">{txId}</span></div>
              <div><span>Status:</span> <strong>{txStatus || 'Pending'}</strong></div>
              {blockHeight && <div><span>Block Height Used:</span> {blockHeight}</div>}
            </div>
            <div className="instruction-box" style={{ marginTop: '1rem' }}>
              <strong>Next step:</strong> Copy the TX ID above, go to the <strong>Register</strong> tab,
              paste it in, and register your ETH wallet to start trading with tier-based fees on Uniswap V4.
            </div>
            <button
              className="btn btn-sm"
              style={{ marginTop: '0.75rem' }}
              onClick={() => {
                navigator.clipboard.writeText(txId);
              }}
            >
              📋 Copy TX ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
