import { formatAddress } from '../utils/constants';

export function ConnectWallet({ address, isConnecting, onConnect, onDisconnect }) {
    if (address) {
        return (
            <div className="wallet-connected">
                <span className="wallet-address">{formatAddress(address)}</span>
                <button className="btn-small" onClick={onDisconnect}>
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button 
            className="btn-connect" 
            onClick={onConnect}
            disabled={isConnecting}
        >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
    );
}