# Payo — Crypto Payments, As Easy As a Link

> โอน crypto ง่ายเหมือน PromptPay

Payo เป็นแพลตฟอร์มสร้าง payment link สำหรับ crypto ที่ทำงานแบบ trustless — เงินโอนตรงจาก payer ไป payee โดยไม่ผ่านตัวกลาง รองรับ ETH และ ERC-20 tokens บน L2 chains (Base, Optimism, Arbitrum) พร้อม QR code, i18n ภาษาไทย/อังกฤษ, และ dashboard สำหรับติดตามธุรกรรม

**Live:** [payo.cash](https://payo.cash)

---

## สารบัญ

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Supported Chains & Tokens](#supported-chains--tokens)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Smart Contract](#smart-contract)
- [Database](#database)
- [API Routes](#api-routes)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Core
- สร้าง payment link พร้อม QR code แบบ real-time (ไม่ต้องกดปุ่ม generate)
- รองรับ ETH (native) และ ERC-20 tokens (USDC, USDT, DAI, cbBTC)
- Multi-chain: Base, Optimism, Arbitrum (testnet + mainnet)
- HMAC tamper detection — ป้องกันการแก้ไข link
- Payment link expiry (1 วัน / 7 วัน / 30 วัน / ไม่มีวันหมดอายุ)
- On-chain fee contract แบบ basis points พร้อม fee splitting

### UX
- i18n ภาษาไทย / English พร้อม toggle
- ENS name resolution สำหรับแสดงชื่อ wallet
- Jazzicon avatar แทน emoji
- Fiat price display (≈ $XX.XX) ผ่าน CoinGecko API
- Mobile detection + "Open in Wallet" button
- Confetti animation เมื่อโอนสำเร็จ
- Self-payment warning
- Gas-for-ERC20 education callout
- Collapsible fee breakdown
- Retry UX พร้อมนับจำนวนครั้ง

### Dashboard
- ดู payment links ที่สร้างไว้ พร้อม status badges (Active / Expired)
- Transaction history จาก Basescan API พร้อม filter (token, direction, date range)
- Daily volume chart
- CSV export สำหรับทำบัญชี/ภาษี
- QR modal + Web Share API
- Match TX กับ link อัตโนมัติ
- Fee dashboard (company wallet only)

### Demo Mode
- ทดลองใช้งานได้โดยไม่ต้อง connect wallet
- Demo flow: สร้าง link → ดู pay page → success screen

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
| Smart Contract | Solidity 0.8.20 + [Hardhat 3](https://hardhat.org) + [OpenZeppelin](https://www.openzeppelin.com/contracts) |
| Validation | [Zod 4](https://zod.dev) |
| Testing | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) + [fast-check](https://fast-check.dev) |
| Deployment | [Vercel](https://vercel.com) |

---

## Supported Chains & Tokens

| Chain | Chain ID | Tokens | Status |
|-------|----------|--------|--------|
| Base Sepolia | 84532 | ETH, USDC | Testnet (default) |
| Base Mainnet | 8453 | ETH, USDC, USDT, DAI, cbBTC | Production |
| Optimism | 10 | ETH, USDC, USDT, DAI | Production |
| Arbitrum One | 42161 | ETH, USDC, USDT, DAI | Production |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│  Next.js App Router (React 19 + TypeScript)             │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ │
│  │ Landing  │ │ Create   │ │ Pay/[id]  │ │ Dashboard │ │
│  │ Page     │ │ Page     │ │ Page      │ │ Page      │ │
│  └──────────┘ └──────────┘ └───────────┘ └───────────┘ │
│        │            │            │              │       │
│  ┌─────┴────────────┴────────────┴──────────────┘       │
│  │  RainbowKit + wagmi + viem (wallet connection)       │
│  └──────────────────────────────────────────────────────│
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   API Routes                            │
│  POST /api/links       — สร้าง payment link + HMAC     │
│  GET  /api/links       — นับจำนวน active links         │
│  GET  /api/links/[id]  — decode + verify + log view    │
│  GET  /api/tx/[address]— ดึง TX history (Basescan)     │
│  GET  /api/fees/[addr] — ดึง fee TX history            │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
┌──────────▼──────────┐ ┌────────▼────────────────────────┐
│   Neon PostgreSQL   │ │   Blockchain (Base / OP / Arb)  │
│   (Drizzle ORM)     │ │   ┌─────────────────────────┐   │
│                     │ │   │ CryptoPayLinkFee.sol    │   │
│   • users           │ │   │ (fee splitting contract) │   │
│   • payment_links   │ │   └─────────────────────────┘   │
│   • link_events     │ │   Basescan API (TX history)     │
│   • transactions    │ └─────────────────────────────────┘
│   • rate_limit_log  │
└─────────────────────┘
```

### Payment Flow

```
ผู้สร้าง Link                    ผู้โอนเงิน
     │                                │
     │  1. กรอก address/token/amount  │
     │  2. QR + link generate ทันที   │
     │  3. แชร์ link หรือ QR          │
     │  ─────────────────────────►    │
     │                                │  4. เปิด link
     │                                │  5. Connect wallet
     │                                │  6. ตรวจ HMAC + expiry
     │                                │  7. กด Pay → sign TX
     │                                │  8. TX confirm on-chain
     │                                │  9. Confetti 🎉
     │                                │
```

---

## Project Structure

```
crypto-pay-link/
├── contracts/
│   └── CryptoPayLinkFee.sol       # Solidity fee contract
├── drizzle/                        # DB migration files
├── scripts/
│   └── deploy.ts                   # Hardhat deploy script
├── src/
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── layout.tsx              # Root layout + providers
│   │   ├── providers.tsx           # wagmi + RainbowKit + TanStack Query
│   │   ├── globals.css             # Tailwind + custom styles
│   │   ├── create/page.tsx         # สร้าง payment link
│   │   ├── pay/[id]/page.tsx       # หน้าชำระเงิน
│   │   ├── dashboard/page.tsx      # Dashboard (links + TX history)
│   │   ├── demo/                   # Demo flow (ไม่ต้อง connect wallet)
│   │   ├── u/[slug]/               # Public profile page
│   │   └── api/
│   │       ├── links/route.ts      # POST สร้าง link / GET นับ link
│   │       ├── links/[id]/route.ts # GET decode + verify link
│   │       ├── tx/[address]/       # GET TX history จาก Basescan
│   │       ├── fees/[address]/     # GET fee TX history
│   │       ├── dashboard/          # GET dashboard stats
│   │       ├── profile/            # GET/POST user profile
│   │       ├── username/           # GET/POST username
│   │       ├── webhooks/           # POST payment webhook
│   │       └── notifications/      # POST push notification sub
│   ├── components/
│   │   ├── Navbar.tsx              # Navigation bar + wallet + lang toggle
│   │   ├── Footer.tsx              # Footer
│   │   ├── PayoLogo.tsx            # Brand logo SVG
│   │   ├── QRDisplay.tsx           # QR code + copy + share
│   │   ├── QrLinkModal.tsx         # QR modal สำหรับ dashboard
│   │   ├── TokenSelector.tsx       # Token picker (ETH/USDC/...)
│   │   ├── ChainSelector.tsx       # Chain picker
│   │   ├── Jazzicon.tsx            # Wallet avatar
│   │   ├── SuccessView.tsx         # TX success + receipt
│   │   ├── DownloadReceiptButton.tsx # PDF receipt download
│   │   ├── BlockedScreen.tsx       # HMAC tamper blocked
│   │   ├── WrongNetworkBanner.tsx  # Wrong chain warning
│   │   ├── Skeleton.tsx            # Loading skeleton
│   │   ├── DemoBadge.tsx           # Demo mode indicator
│   │   ├── DemoNavbar.tsx          # Demo navigation
│   │   └── DemoStepIndicator.tsx   # Demo step progress
│   ├── context/
│   │   └── LangContext.tsx         # i18n context (TH/EN)
│   ├── hooks/
│   │   ├── useCoinGeckoPrice.ts    # Fiat price hook
│   │   └── useIsCompanyWallet.ts   # Company wallet check
│   └── lib/
│       ├── encode.ts               # Payment link encode/decode (base64url)
│       ├── hmac.ts                 # HMAC-SHA256 signing + verification
│       ├── validate.ts             # Link validation
│       ├── i18n.ts                 # Thai + English translations
│       ├── tokens.ts               # Token type definitions
│       ├── tokenRegistry.ts        # Token list per chain
│       ├── chainRegistry.ts        # Supported chains
│       ├── wagmi.ts                # wagmi config
│       ├── contract.ts             # Contract ABI + address
│       ├── fee.ts                  # Fee calculation
│       ├── fiatCalc.ts             # Fiat value calculation
│       ├── db.ts                   # Drizzle DB connection (Neon)
│       ├── schema.ts              # Drizzle schema (5 tables)
│       ├── rate-limit.ts           # Rate limiter
│       ├── self-payment.ts         # Self-payment guard
│       ├── mobileDetect.ts         # Mobile browser detection
│       ├── addressValidation.ts    # Ethereum address validation
│       ├── demo.ts                 # Demo mode utilities
│       ├── og-metadata.ts          # OpenGraph metadata
│       ├── link-events.ts          # Link event logging helpers
│       ├── tx-cache.ts             # TX history cache layer
│       ├── shareUrl.ts             # Share URL builder
│       ├── receiptData.ts          # Receipt data helpers
│       ├── generateReceiptPdf.ts   # PDF receipt generation
│       ├── push.ts                 # Push notification helpers
│       ├── webhook.ts              # Webhook dispatch
│       ├── webhookPayload.ts       # Webhook payload types
│       └── validate-storage.ts     # localStorage validation
├── middleware.ts                    # Security headers + route guards
├── hardhat.config.ts               # Hardhat config (Base Sepolia)
├── drizzle.config.ts               # Drizzle Kit config
├── next.config.ts                  # Next.js config
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+ หรือ [Bun](https://bun.sh)
- [WalletConnect Project ID](https://cloud.walletconnect.com/) (ฟรี)
- [Basescan API Key](https://basescan.org/myapikey) (optional, สำหรับ TX history)

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/crypto-pay-link.git
cd crypto-pay-link

# Install dependencies
npm install
# หรือ
bun install
```

### Configuration

```bash
# Copy environment template
cp .env.local.example .env.local
```

แก้ไข `.env.local` ตาม [Environment Variables](#environment-variables)

### Development

```bash
npm run dev
# หรือ
bun dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm start
```

---

## Environment Variables

สร้างไฟล์ `.env.local` จาก `.env.local.example`:

```env
# [Required] WalletConnect Project ID
# สมัครฟรีที่ https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# [Required] HMAC Secret สำหรับ tamper detection
HMAC_SECRET=your-random-secret-here

# [Optional] Basescan API Key สำหรับ TX history ใน dashboard
# สมัครที่ https://basescan.org/myapikey
BASESCAN_API_KEY=your_basescan_api_key_here

# [Optional] Chain ID (default: 84532 = Base Sepolia testnet)
# ใช้ 8453 สำหรับ Base mainnet
NEXT_PUBLIC_CHAIN_ID=84532

# [Optional] Company wallet address สำหรับรับ fee
NEXT_PUBLIC_COMPANY_WALLET=0xYourCompanyWalletAddress

# [Optional] Deployed contract address (ตั้งหลัง deploy contract)
NEXT_PUBLIC_CONTRACT_ADDRESS=

# [Optional] Deployer private key (สำหรับ deploy contract เท่านั้น)
# ห้าม commit ไฟล์นี้
DEPLOYER_PRIVATE_KEY=

# [Optional] Neon PostgreSQL connection string
# สมัครฟรีที่ https://neon.tech
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> ⚠️ ไฟล์ `.env.local` อยู่ใน `.gitignore` แล้ว — ห้าม commit private keys

---

## Smart Contract

### CryptoPayLinkFee.sol

Contract สำหรับ payment พร้อม fee splitting แบบ basis points:

- รองรับ ETH (native) และ ERC-20 tokens
- Fee rate กำหนดเป็น basis points (max 1000 = 10%)
- เงินแบ่งอัตโนมัติ: payee ได้ส่วนหลัก, company wallet ได้ fee
- Owner สามารถอัปเดต fee rate และ company wallet
- ใช้ OpenZeppelin `Ownable` + `SafeERC20`

### Deploy Contract

```bash
# ตั้ง DEPLOYER_PRIVATE_KEY ใน .env.local ก่อน
npm run deploy
```

Script จะ deploy ไปที่ Base Sepolia แล้วแสดง contract address — นำไปใส่ `NEXT_PUBLIC_CONTRACT_ADDRESS`

---

## Database

ใช้ Neon (serverless PostgreSQL) + Drizzle ORM — optional สำหรับ MVP (fallback เป็น URL-based + localStorage)

### Schema (5 tables)

| Table | หน้าที่ |
|-------|--------|
| `users` | เก็บ wallet address + ENS cache สำหรับ cross-device sync |
| `payment_links` | เก็บ link ที่สร้าง แทน localStorage |
| `link_events` | Log events (viewed, paid, expired, tamper_blocked) สำหรับ analytics |
| `transactions` | Cache TX history จาก Basescan ลด API calls |
| `rate_limit_log` | Persistent rate limiting แทน in-memory |

### Setup Database

```bash
# 1. สมัคร Neon (ฟรี) แล้วเพิ่ม DATABASE_URL ใน .env.local

# 2. Generate migration
npm run db:generate

# 3. Push schema ไป Neon
npm run db:push
```

> ถ้าไม่ตั้ง `DATABASE_URL` แอปจะ fallback เป็น URL-based encoding + localStorage ตามปกติ

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/links` | สร้าง payment link ใหม่ (encode + HMAC sign + DB insert) |
| `GET` | `/api/links` | นับจำนวน active payment links |
| `GET` | `/api/links/[id]` | Decode + verify HMAC + log view event |
| `GET` | `/api/tx/[address]` | ดึง transaction history จาก Basescan API |
| `GET` | `/api/fees/[address]` | ดึง fee transaction history (company wallet only) |
| `GET` | `/api/dashboard` | ดึงข้อมูล dashboard (links + stats) |
| `GET/POST` | `/api/profile` | ดึง/อัปเดต user profile |
| `GET/POST` | `/api/username` | ตรวจสอบ / ตั้ง username สำหรับ `/u/[slug]` |
| `POST` | `/api/webhooks` | Webhook endpoint สำหรับ payment confirmation |
| `POST` | `/api/notifications` | Push notification subscription |

### ตัวอย่าง: สร้าง Payment Link

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "token": "ETH",
    "amount": "0.01",
    "memo": "ค่ากาแฟ",
    "chainId": 84532
  }'
```

Response:
```json
{
  "id": "eyJhZGRyZXNzIjoi...",
  "url": "https://your-domain.com/pay/eyJhZGRyZXNzIjoi..."
}
```

---

## Security

### HMAC Tamper Detection
ทุก payment link ถูก sign ด้วย HMAC-SHA256 ฝั่ง server — ถ้า URL ถูกแก้ไข จะแสดง `BlockedScreen` และไม่อนุญาตให้โอน

### Security Headers (Middleware)
- `X-Frame-Options: DENY` — ป้องกัน clickjacking
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` — บังคับ HTTPS
- `Content-Security-Policy` — จำกัด script/connect sources
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — ปิด camera, microphone, geolocation

### Rate Limiting
API routes มี rate limiting ป้องกัน abuse (in-memory, persistent เมื่อมี DB)

### Input Validation
- Ethereum address validation (checksum + format)
- Zod schema validation สำหรับ API inputs
- Self-payment guard — เตือนเมื่อ payer = payee

---

## Testing

```bash
# รัน test ทั้งหมด
npm test

# รัน test เฉพาะไฟล์
npx vitest --run src/lib/__tests__/encode.test.ts
```

### Test Coverage

โปรเจกต์มี unit tests และ property-based tests (fast-check) ครอบคลุม:

- Encoding/decoding roundtrip
- HMAC signing + verification
- Fee calculation
- Address validation
- i18n key parity (TH/EN)
- Chain/token registry
- Rate limiting
- Dashboard aggregation
- API route responses
- Component rendering (Navbar, TokenSelector, SuccessView, etc.)

---

## Deployment

### Vercel (แนะนำ)

1. Push code ไป GitHub
2. Import project ใน [Vercel](https://vercel.com)
3. เพิ่ม environment variables ใน Vercel dashboard
4. Deploy อัตโนมัติทุก push

### Environment Variables บน Vercel

ตั้งค่าเหมือน `.env.local` ใน Vercel Dashboard → Settings → Environment Variables

---

## Roadmap

### ✅ Done
- Payment link creation + QR code
- Multi-chain support (Base, Optimism, Arbitrum)
- ETH + ERC-20 payments
- HMAC tamper detection
- i18n (TH/EN)
- Dashboard + TX history + charts + CSV export
- Fee contract + fee dashboard
- Demo mode
- ENS resolution + Jazzicon + fiat prices
- Mobile UX optimizations
- Database integration (Neon + Drizzle) — users, links, events, TX cache, rate limit
- Cross-device sync ผ่าน DB
- Public profile page `/u/[slug]`
- Payment receipt / PDF download
- Payment confirmation webhook
- Push notifications

### 📋 Planned
- Single-use link (Invoice mode)
- LINE / WhatsApp share button
- Multi-chain TX history consolidation
- Mobile app (Expo / React Native)

### 💡 Ideas
- On-ramp integration (Transak / MoonPay)
- Recurring payment links
- Bulk link creation จาก CSV

---

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm test             # Run tests (vitest --run)
npm run deploy       # Deploy contract to Base Sepolia
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
```

---

## License

Private — All rights reserved.
