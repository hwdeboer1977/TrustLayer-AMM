import { useState, useEffect, useCallback } from 'react';

export function useWallet() {
    const [address, setAddress] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    // Check if already connected on mount
    useEffect(() => {
        checkConnection();
        
        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            setAddress(null);
        } else {
            setAddress(accounts[0]);
        }
    };

    const checkConnection = async () => {
        if (!window.ethereum) return;
        
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                setAddress(accounts[0]);
            }
        } catch (err) {
            console.error('Error checking connection:', err);
        }
    };

    const connect = useCallback(async () => {
        if (!window.ethereum) {
            setError('Please install MetaMask');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            setAddress(accounts[0]);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAddress(null);
    }, []);

    return {
        address,
        isConnected: !!address,
        isConnecting,
        error,
        connect,
        disconnect
    };
}
