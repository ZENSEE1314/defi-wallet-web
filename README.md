# DeFi Wallet (Web)

A multi-chain web wallet that connects to dApps via WalletConnect v2.
Built with Next.js + TypeScript + Tailwind + ethers.js v6.

## What it does

- **Wallet management** — create new HD wallets, import seed phrase or private key, delete. Keystores are AES-256-GCM encrypted with a PBKDF2-SHA256 key (310k iterations) and stored in `localStorage`.
- **Multi-chain** — Ethereum, Base, Arbitrum, Optimism, Polygon, Sepolia + add custom EVM chains by Chain ID + RPC URL.
- **Send native token** — confirm with your password.
- **WalletConnect v2** — paste a `wc:…` URI from any dApp (Uniswap, Aave, 1inch …) and approve the connection. The wallet handles `eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4`, and `wallet_switchEthereumChain`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npm run dev
```

Open <http://localhost:3000>.

## Get a WalletConnect Project ID

Free at <https://cloud.reown.com>. Without one, the WalletConnect tab shows a warning and pairing won't work — everything else still does.

## Deploy

Push to GitHub, then in Vercel: Import → set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var → Deploy.

## Security model — read this

- Keys live in your browser's `localStorage`, encrypted at rest. The plaintext never leaves the page.
- **localStorage is more exposed than a desktop keystore.** Any XSS on the page can read it. So:
  - Only use this wallet on the canonical URL you trust.
  - Don't paste your seed phrase from a wallet that holds significant funds. Treat this as a convenient hot wallet for small balances + dApp interactions.
  - For real money, use a hardware wallet or a properly audited extension wallet.
- Every signing request requires your password. There is no auto-unlock.
