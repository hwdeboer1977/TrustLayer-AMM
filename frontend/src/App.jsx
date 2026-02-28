import { useState, useEffect } from 'react';
import { useWallet } from './hooks/useWallet';
import { useWallet as useAleoWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletMultiButton } from '@demox-labs/aleo-wallet-adapter-reactui';
import { getBlockHeight } from './utils/api';
import {
  ConnectWallet,
  MyStatus,
  RegisterMe,
  VerifyProof,
  Admin,
  SwapPanel,
  ProveTier,
} from './components';

function App() {
  const {
    address,
    provider,
    signer,
    chainId,
    isConnected,
    isConnecting,
    isCorrectChain,
    connect,
    disconnect,
    switchChain,
  } = useWallet();
  const { publicKey: aleoAddress, connected: aleoConnected } = useAleoWallet();
  const [activeTab, setActiveTab] = useState('swap');
  const [blockHeight, setBlockHeight] = useState(null);

  useEffect(() => {
    fetchBlockHeight();
    const interval = setInterval(fetchBlockHeight, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchBlockHeight = async () => {
    try {
      const data = await getBlockHeight();
      setBlockHeight(data.blockHeight);
    } catch (err) {
      console.error('Failed to fetch block height:', err);
    }
  };

  const tabs = [
    { id: 'swap', label: 'Swap', icon: '💱' },
    { id: 'status', label: 'My Status', icon: '👤' },
    { id: 'prove', label: 'Prove Tier', icon: '🔐' },
    { id: 'register', label: 'Register', icon: '🔗' },
    { id: 'verify', label: 'Verify Proof', icon: '🔍' },
    { id: 'admin', label: 'Admin', icon: '⚙️' },
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🔐</span>
            <div>
              <h1>TrustLayer AMM</h1>
              <p className="subtitle">ZK Credit-Score-Weighted Trading on Uniswap V4</p>
            </div>
          </div>
          <div className="header-wallets">
            <WalletMultiButton />
            <ConnectWallet
              address={address}
              chainId={chainId}
              isConnecting={isConnecting}
              isCorrectChain={isCorrectChain}
              onConnect={connect}
              onDisconnect={disconnect}
              onSwitchChain={switchChain}
            />
          </div>
        </div>
      </header>

      <main className="container">
        <div className="status-bar">
          <div className="status-left">
            <span className={`status ${aleoConnected ? 'aleo-connected' : 'aleo'}`}>
              ● Aleo {aleoConnected ? `(${aleoAddress?.slice(0, 8)}...)` : 'Not Connected'}
            </span>
            <span className="block">Block: {blockHeight?.toLocaleString() || '...'}</span>
          </div>
          <div className="status-right">
            <span className={`status ${isConnected ? 'eth-connected' : 'eth-disconnected'}`}>
              ● {isConnected ? `Arb Sepolia` : 'ETH Not Connected'}
            </span>
          </div>
        </div>

        <div className="flow-info">
          <h3>How it works</h3>
          <div className="flow-steps">
            <div className="flow-step">
              <span className="flow-num">1</span>
              <span className="flow-icon">🏛️</span>
              <span>Issuer creates credential</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">2</span>
              <span className="flow-icon">🔐</span>
              <span>User proves tier via ZK</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">3</span>
              <span className="flow-icon">🔗</span>
              <span>Register ETH wallet</span>
            </div>
            <span className="flow-arrow">→</span>
            <div className="flow-step">
              <span className="flow-num">4</span>
              <span className="flow-icon">💱</span>
              <span>Swap with tier fees</span>
            </div>
          </div>
        </div>

        <nav className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="tab-content">
          {activeTab === 'swap' && (
            <SwapPanel
              address={address}
              signer={signer}
              provider={provider}
              isCorrectChain={isCorrectChain}
            />
          )}
          {activeTab === 'status' && <MyStatus address={address} />}
          {activeTab === 'prove' && <ProveTier />}
          {activeTab === 'register' && <RegisterMe address={address} />}
          {activeTab === 'verify' && <VerifyProof />}
          {activeTab === 'admin' && <Admin />}
        </div>
      </main>

      <footer className="footer">
        <p>TrustLayer AMM — Aleo ZK Proofs + Uniswap V4 Hooks</p>
      </footer>
    </div>
  );
}

export default App;
