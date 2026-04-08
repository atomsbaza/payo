# Payo — Crypto Transfers, As Easy As a Link

Payo is a non-custodial crypto transfer link platform. Create a shareable link or QR code, send it to anyone, and they can transfer ETH or ERC-20 tokens directly to your wallet — no middleman, no custody.

**Live:** [payo.cash](https://payo.cash) · **Open Source:** [github.com/atomsbaza/payo](https://github.com/atomsbaza/payo)

---

## Features

- Create transfer links with QR code in real-time
- ETH (native) and ERC-20 tokens (USDC, USDT, DAI, cbBTC)
- Multi-chain: Base, Optimism, Arbitrum (testnet + mainnet)
- HMAC tamper detection — links cannot be modified
- Transfer link expiry (1 day / 7 days / 30 days / none)
- Single-use (invoice) mode — auto-deactivates after first transfer
- On-chain fee contract with basis-point fee splitting
- Dashboard with transfer links, TX history, charts, CSV export
- Public profile page `/u/[slug]`
- Transfer receipt PDF download
- Transfer confirmation webhook (n8n compatible)
- Demo mode — try without connecting a wallet
- ENS name resolution + Jazzicon avatar
- Fiat price display via CoinGecko
- Contact / feedback page
- Legal disclaimer + Terms of Service
- 100% Non-Custodial & Trustless

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Wallet | [RainbowKit 2](https://www.rainbowkit.com) + [wagmi 2](https://wagmi.sh) + [viem](https://viem.sh) |
| QR Code | [qrcode.react](https://github.com/zpao/qrcode.react) |
| State | [TanStack Query 5](https://tanstack.com/query) |
| Database | [Neon](https://neon.tech) (PostgreSQL) + [Drizzle ORM](https://orm.drizzle.team) |
| Smart Contract | Solidity 0.8.20 + [Hardhat 3](https://hardhat.org) |
| Validation | [Zod 4](https://zod.dev) |
| Testing | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) + [fast-check](https://fast-check.dev) |
| Deployment | [Vercel](https://vercel.com) |

---

## Supported Chains & Tokens

| Chain | Chain ID | Tokens |
|-------|----------|--------|
| Base Sepolia | 84532 | ETH, USDC (testnet default) |
| Base Mainnet | 8453 | ETH, USDC, USDT, DAI, cbBTC |
| Optimism | 10 | ETH, USDC, USDT, DAI |
| Arbitrum One | 42161 | ETH, USDC, USDT, DAI |

---

## Getting Started

### Prerequisites

- Node.js 20+
- [WalletConnect Project ID](https://cloud.walletconnect.com/) (free)

### Installation

```bash
git clone https://github.com/atomsbaza/payo.git
cd payo
npm install
```

### Configuration

```bash
cp .env.local.example .env.local
```

Edit `.env.local` — see [Environment Variables](#environment-variables).

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```env
# [Required] WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# [Required] HMAC secret for tamper detection
HMAC_SECRET=your-random-secret-here

# [Optional] Basescan API key for TX history
BASESCAN_API_KEY=your_basescan_api_key_here

# [Optional] App environment — set to "production" to hide testnets
NEXT_PUBLIC_APP_ENV=production

# [Optional] Company wallet address for fee collection
NEXT_PUBLIC_COMPANY_WALLET=0xYourCompanyWalletAddress

# [Optional] Deployed contract address
NEXT_PUBLIC_CONTRACT_ADDRESS=

# [Optional] Deployer private key (for contract deployment only — never commit)
DEPLOYER_PRIVATE_KEY=

# [Optional] Neon PostgreSQL connection string
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> `.env.local` is in `.gitignore` — never commit private keys.

---

## Smart Contract

`CryptoPayLinkFee.sol` handles transfer + fee splitting:

- Supports ETH (native) and ERC-20 tokens
- Fee rate in basis points (max 1000 = 10%)
- Funds split automatically: recipient gets the principal, company wallet gets the fee
- Owner can update fee rate and company wallet

```bash
# Deploy to Base Sepolia
npm run deploy
```

Copy the deployed address into `NEXT_PUBLIC_CONTRACT_ADDRESS`.

---

## Database

Uses Neon (serverless PostgreSQL) + Drizzle ORM. The app works without a database (falls back to URL-based encoding + localStorage).

### Schema

| Table | Purpose |
|-------|---------|
| `users` | Wallet address + ENS cache |
| `payment_links` | Created transfer links |
| `link_events` | Event log (viewed, paid, expired, tamper_blocked) |
| `transactions` | Basescan TX history cache |
| `rate_limit_log` | Persistent rate limiting |
| `push_tokens` | APNs device tokens |
| `feedback` | Contact form submissions |

```bash
npm run db:generate   # Generate Drizzle migrations
npm run db:push       # Push schema to Neon
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/links` | Create transfer link (encode + HMAC sign + DB insert) |
| `GET` | `/api/links` | Count active transfer links |
| `GET` | `/api/links/[id]` | Decode + verify HMAC + log view |
| `POST` | `/api/links/[id]` | Confirm transfer (increment pay count, fire webhook) |
| `GET` | `/api/tx/[address]` | Fetch TX history from Basescan |
| `GET` | `/api/fees/[address]` | Fetch fee TX history |
| `GET` | `/api/dashboard/[address]` | Dashboard stats |
| `GET/PUT` | `/api/username/[address]` | Get / set username |
| `GET` | `/api/profile/[slug]` | Public profile data |
| `GET/POST` | `/api/webhooks/[address]` | Webhook registration |
| `POST` | `/api/webhooks/[address]/test` | Send test webhook |
| `POST` | `/api/notifications/register` | Register APNs device token |
| `DELETE` | `/api/notifications/register` | Unregister APNs device token |
| `POST` | `/api/feedback` | Submit contact form |

---

## Security

- **HMAC tamper detection** — every link is signed server-side; modified URLs show a blocked screen
- **Security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Rate limiting** — API routes are rate-limited (in-memory, persistent with DB)
- **Input validation** — Zod schemas on all API inputs, Ethereum address checksum validation
- **Self-payment guard** — warns when sender and recipient are the same wallet
- **Non-custodial** — Payo never holds private keys or funds; all transfers are peer-to-peer on-chain

---

## Testing

```bash
npm test                          # Run all tests
npx vitest --run path/to/test.ts  # Run a specific test file
```

Tests use Vitest + fast-check (property-based testing). 559+ tests covering encoding, HMAC, fee calculation, address validation, API routes, middleware, components, and more.

---

## Deployment

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel Dashboard → Settings → Environment Variables
4. Deploy — automatic on every push

---

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint
npm test             # Run tests
npm run deploy       # Deploy contract to Base Sepolia
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
```

---

## License

MIT
