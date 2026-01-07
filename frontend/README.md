# TrustLayer Frontend

React UI for managing TrustLayer credentials and trading access.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment

The frontend proxies API requests to the backend (default: `localhost:3001`).

Edit `vite.config.js` to change the backend URL:

```js
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true
  }
}
```

## Features

### Tabs

| Tab | Description |
|-----|-------------|
| **My Status** | View your tier, fee, max trade size, expiry |
| **Register Me** | Link Aleo proof to your ETH wallet |
| **Verify Proof** | Check any Aleo prove_tier transaction |
| **Admin** | Lookup traders, view hook info, revoke access |

### User Flow

```
1. Connect ETH wallet (MetaMask/Rabby)
2. Enter your Aleo prove_tier TX ID
3. Click "Verify Proof"
4. Click "Register" → Backend registers you on-chain
5. View status in "My Status" tab
```

## Project Structure

```
src/
├── components/
│   ├── ConnectWallet.jsx   # Wallet connection button
│   ├── MyStatus.jsx        # Status display tab
│   ├── RegisterMe.jsx      # Registration tab
│   ├── VerifyProof.jsx     # Proof verification tab
│   ├── Admin.jsx           # Admin panel tab
│   └── StatusCard.jsx      # Reusable UI components
├── hooks/
│   └── useWallet.js        # MetaMask integration
├── utils/
│   ├── api.js              # Backend API calls
│   └── constants.js        # Tier names, formatters
├── App.jsx
├── index.css
└── main.jsx
```

## Dependencies

- React 18
- Vite 5
- No web3 library needed (wallet connection via `window.ethereum`)

## Scripts

```bash
npm run dev      # Development server (port 3000)
npm run build    # Production build
npm run preview  # Preview production build
```

## License

MIT
