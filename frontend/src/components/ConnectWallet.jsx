import { CHAIN_CONFIG } from '../abis/contracts';

export default function ConnectWallet({ address, chainId, isConnecting, isCorrectChain, onConnect, onDisconnect, onSwitchChain }) {
  const truncated = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (!address) {
    return (
      <button className="btn btn-connect" onClick={onConnect} disabled={isConnecting}>
        {isConnecting ? '⏳ Connecting...' : '🔗 Connect EVM Wallet'}
      </button>
    );
  }

  return (
    <div className="wallet-info">
      {!isCorrectChain && (
        <button className="btn btn-warning" onClick={onSwitchChain}>
          ⚠️ Switch to {CHAIN_CONFIG.chainName}
        </button>
      )}
      <div className="wallet-address">
        <span className="wallet-dot" />
        <span>{truncated}</span>
      </div>
      <button className="btn btn-sm btn-ghost" onClick={onDisconnect}>Disconnect</button>
    </div>
  );
}
