import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react'
import { WalletModalProvider } from '@demox-labs/aleo-wallet-adapter-reactui'
import { DecryptPermission, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base'
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo'

// Import wallet adapter default styles
import '@demox-labs/aleo-wallet-adapter-reactui/dist/styles.css'

function Root() {
  const wallets = useMemo(
    () => [
      new LeoWalletAdapter({
        appName: 'TrustLayer AMM',
      }),
    ],
    []
  )

  return (
    <WalletProvider
      wallets={wallets}
      decryptPermission={DecryptPermission.ViewKeyAccess}
      network={WalletAdapterNetwork.TestnetBeta}
      autoConnect
    >
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
