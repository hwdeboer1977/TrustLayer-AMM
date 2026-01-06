import { useState, useEffect } from 'react'

const API_URL = '/api'

function App() {
  const [activeTab, setActiveTab] = useState('verify-tx')
  const [blockHeight, setBlockHeight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Form states
  const [txId, setTxId] = useState('')
  const [commitment, setCommitment] = useState('')
  const [issuerAddress, setIssuerAddress] = useState('')

  // Fetch block height on mount
  useEffect(() => {
    fetchBlockHeight()
  }, [])

  const fetchBlockHeight = async () => {
    try {
      const res = await fetch(`${API_URL}/block-height`)
      const data = await res.json()
      setBlockHeight(data.blockHeight)
    } catch (err) {
      console.error('Failed to fetch block height:', err)
    }
  }

  const handleVerifyTx = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${API_URL}/verify-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId })
      })
      const data = await res.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCommitment = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${API_URL}/verify/${commitment}`)
      const data = await res.json()
      setResult({ ...data, type: 'commitment' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIssuer = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${API_URL}/issuer/${issuerAddress}`)
      const data = await res.json()
      setResult({ ...data, type: 'issuer' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTierClass = (tier) => {
    return `tier-badge tier-${tier}`
  }

  const getTierName = (tier) => {
    const names = {
      0: 'Ineligible',
      1: 'Tier C (Basic)',
      2: 'Tier B (Pro)',
      3: 'Tier A (Whale)'
    }
    return names[tier] || 'Unknown'
  }

  return (
    <div className="container">
      <h1>🔐 TrustLayer Credentials</h1>
      <p className="subtitle">Zero-Knowledge Credential Verification</p>

      <div className="status-bar">
        <span className="status">● Connected to Aleo Testnet</span>
        <span className="block">Block: {blockHeight?.toLocaleString() || '...'}</span>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'verify-tx' ? 'active' : ''}`}
          onClick={() => { setActiveTab('verify-tx'); setResult(null); setError(null); }}
        >
          Verify Proof TX
        </button>
        <button 
          className={`tab ${activeTab === 'verify-commitment' ? 'active' : ''}`}
          onClick={() => { setActiveTab('verify-commitment'); setResult(null); setError(null); }}
        >
          Check Commitment
        </button>
        <button 
          className={`tab ${activeTab === 'check-issuer' ? 'active' : ''}`}
          onClick={() => { setActiveTab('check-issuer'); setResult(null); setError(null); }}
        >
          Check Issuer
        </button>
      </div>

      {/* Verify Transaction Tab */}
      {activeTab === 'verify-tx' && (
        <div className="card">
          <h2>Verify Proof Transaction</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Enter a prove_tier transaction ID to verify the credential and see the tier.
          </p>
          <form onSubmit={handleVerifyTx}>
            <div className="input-group">
              <label>Transaction ID</label>
              <input
                type="text"
                placeholder="at1yqvv5d7wg8wyehvymncxqguedg8nvnt3qv2aar5evh8ummv0jy9s75clke"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading || !txId}>
              {loading ? 'Verifying...' : 'Verify Proof'}
            </button>
          </form>

          {result && result.tier !== undefined && (
            <div className={`result ${result.isValid ? 'success' : 'error'}`}>
              <h3>{result.isValid ? '✓ Valid Credential' : '✗ Invalid Credential'}</h3>
              <div className={getTierClass(result.tier)}>
                {getTierName(result.tier)}
              </div>
              <div className="info-row">
                <span className="label">Tier</span>
                <span className="value">{result.tier}</span>
              </div>
              <div className="info-row">
                <span className="label">Commitment</span>
                <span className="value">{result.commitment?.slice(0, 20)}...</span>
              </div>
              <div className="info-row">
                <span className="label">Was Issued</span>
                <span className={`value ${result.wasIssued ? 'valid' : 'invalid'}`}>
                  {result.wasIssued ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Is Revoked</span>
                <span className={`value ${result.isRevoked ? 'invalid' : 'valid'}`}>
                  {result.isRevoked ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Block Checked</span>
                <span className="value">{result.currentBlock}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verify Commitment Tab */}
      {activeTab === 'verify-commitment' && (
        <div className="card">
          <h2>Check Commitment</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Check if a credential commitment was issued and if it's still valid.
          </p>
          <form onSubmit={handleVerifyCommitment}>
            <div className="input-group">
              <label>Commitment Hash</label>
              <input
                type="text"
                placeholder="6613525484358723320868794385596564615804189162981013393787560339710562192009field"
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading || !commitment}>
              {loading ? 'Checking...' : 'Check Commitment'}
            </button>
          </form>

          {result && result.type === 'commitment' && (
            <div className={`result ${result.isValid ? 'success' : 'error'}`}>
              <h3>{result.isValid ? '✓ Valid Credential' : '✗ Invalid Credential'}</h3>
              <div className="info-row">
                <span className="label">Was Issued</span>
                <span className={`value ${result.wasIssued ? 'valid' : 'invalid'}`}>
                  {result.wasIssued ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Is Revoked</span>
                <span className={`value ${result.isRevoked ? 'invalid' : 'valid'}`}>
                  {result.isRevoked ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check Issuer Tab */}
      {activeTab === 'check-issuer' && (
        <div className="card">
          <h2>Check Issuer</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Check if an address is an approved credential issuer.
          </p>
          <form onSubmit={handleCheckIssuer}>
            <div className="input-group">
              <label>Issuer Address</label>
              <input
                type="text"
                placeholder="aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0"
                value={issuerAddress}
                onChange={(e) => setIssuerAddress(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading || !issuerAddress}>
              {loading ? 'Checking...' : 'Check Issuer'}
            </button>
          </form>

          {result && result.type === 'issuer' && (
            <div className={`result ${result.isApproved ? 'success' : 'error'}`}>
              <h3>{result.isApproved ? '✓ Approved Issuer' : '✗ Not Approved'}</h3>
              <div className="info-row">
                <span className="label">Address</span>
                <span className="value">{result.address?.slice(0, 20)}...</span>
              </div>
              <div className="info-row">
                <span className="label">Status</span>
                <span className={`value ${result.isApproved ? 'valid' : 'invalid'}`}>
                  {result.isApproved ? 'Approved' : 'Not Approved'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="result error">
          <h3>Error</h3>
          <p style={{ color: '#f87171' }}>{error}</p>
        </div>
      )}
    </div>
  )
}

export default App
