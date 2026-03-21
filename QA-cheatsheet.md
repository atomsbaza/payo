# 📋 Q&A Cheat Sheet — Crypto Pay Link

> ตอบสั้น กระชับ ได้ใจความ — เรียงตามหมวดที่มักถูกถาม

---

## 🏗️ Architecture

**Q: ทำไมเลือก Base Sepolia?**
- Base = L2 ของ Coinbase (OP Stack), gas < $0.01/tx
- ตอนนี้ใช้ testnet, พร้อม deploy mainnet แค่เปลี่ยน RPC + chainId

**Q: ทำไมไม่ใช้ database?**
- Stateless — ข้อมูล payment link encode เป็น base64url ฝังใน URL
- ไม่ต้องมี DB server, scale ได้ไม่จำกัด, ไม่มี single point of failure
- Saved links ฝั่ง user ใช้ localStorage + Zod validation

**Q: Data อยู่ใน URL ไม่อันตรายเหรอ?**
- ทุก link ถูก sign ด้วย HMAC-SHA256 server-side
- แก้ข้อมูล → signature ไม่ตรง → **block ทั้งหมด** (ไม่ใช่แค่ warning)
- ใช้ `crypto.timingSafeEqual` ป้องกัน timing attack

**Q: Smart contract ออกแบบยังไง?**
- `CryptoPayLinkFee.sol` + OpenZeppelin `Ownable`
- Pass-through — เงินไม่เคยค้างใน contract
- ไม่ต้อง proxy pattern เพราะไม่มี state ที่ต้อง migrate

**Q: Tech stack?**
| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind, RainbowKit, wagmi, viem |
| Contract | Solidity ^0.8.28, Hardhat, OpenZeppelin, Base Sepolia |
| Security | HMAC-SHA256, Zod, CSP, Rate Limiting, HSTS |
| Testing | Vitest, fast-check (PBT), React Testing Library |

---

## 💸 Payment Flow (7 Steps)

| # | Step | รายละเอียด |
|---|------|-----------|
| 1 | Create Link | กรอก address, token, amount, memo → encode base64url |
| 2 | Sign Link | `POST /api/links` → Zod validate → HMAC sign → return URL |
| 3 | Share | ส่ง QR/URL ผ่าน LINE, Discord ฯลฯ (มี OG preview) |
| 4 | Open Link | Decode → Validate → `GET /api/links/{id}` verify HMAC |
| 5 | Connect Wallet | RainbowKit (MetaMask, Coinbase, Rainbow ฯลฯ) |
| 6 | Pay | `payNative()` / `payToken()` → fee split on-chain |
| 7 | Done | 🎉 Receipt + Basescan link |

---

## � Fee System

**Q: Fee คำนวณยังไง?**
- สูตร: `fee = amount × feeRate / 10000` (basis points)
- ใช้ BigInt ทั้ง TypeScript + Solidity → match 100%
- PBT ยืนยัน: `fee + net === total` สำหรับทุก input

**Q: Revenue model?**
- 1% per transaction, enforced on-chain
- Payer ส่ง total → contract split → payee ได้ net, platform ได้ fee

**Q: 1% แพงไหม?**
- Stripe 2.9% + $0.30, PayPal 2.99% — เราถูกกว่า
- Owner ปรับ rate ได้ 0–10% ผ่าน `setFeeRate()`

**Q: Tiny payment ที่ fee = 0?**
- ถ้า `amount × feeRate < 10000` → fee = 0, เงินทั้งหมดไป payee
- ไม่ revert, ไม่มี dust

**Q: ทำไม fee ต้อง on-chain?**
- Off-chain → attacker ส่ง fee = 0 ได้ → ไม่ trustless
- On-chain → contract คำนวณเอง → bypass ไม่ได้

| Config | Value |
|--------|-------|
| Default fee | 1% (100 bp) |
| Max fee | 10% (1000 bp) |
| Basis points | 10000 = 100% |

---

## 🛡️ Security (7 Layers)

| # | Layer | ทำอะไร |
|---|-------|--------|
| 1 | HMAC-SHA256 | Sign ทุก link, tampered → full block |
| 2 | Zod Validation | Address format, token whitelist, amount range, chainId |
| 3 | Rate Limiting | 20 req/min (links), 10 req/min (TX query), per IP |
| 4 | HTTP Headers | CSP, HSTS, X-Frame-Options: DENY, nosniff |
| 5 | Self-Payment Guard | payer === payee → disable Pay button |
| 6 | LocalStorage Validation | Zod validate ก่อนใช้, กรอง corrupt data |
| 7 | API Validation | Server-side validate ทุก field |

**Q: ถ้า HMAC_SECRET หลุด?**
- Attacker forge link ได้ แต่ยังต้องผ่าน input validation
- Production ควร rotate secret + invalidate old links
- Secret อยู่ใน env var ไม่ hardcode

**Q: Rate limiting in-memory ไม่หายเมื่อ restart?**
- ใช่ — trade-off สำหรับ MVP (ไม่ต้อง Redis)
- Production ควรใช้ Redis / Upstash

**Q: ทำไม block tampered link แทนที่จะแค่ warn?**
- Fintech app — warn แล้ว user ยังกด pay ได้ = เงินไปผิด address
- Fail-safe: block ทั้งหมด, แม้ API error ก็ trigger block

**Q: Tampered link flow?**
```
Loading        → Skeleton
verified: true → Payment Card ปกติ
verified: false → BlockedScreen (ไม่มีปุ่ม Pay)
API error      → BlockedScreen (fail-safe)
```

---

## 📜 Smart Contract Detail

**Q: payNative (ETH)?**
- `require(msg.value > 0)` + `require(payee != address(0))`
- คำนวณ fee → ส่ง net ให้ payee → ส่ง fee ให้ company (ถ้า > 0)
- ใช้ `call{value:}` แทน `transfer()` (ไม่มี gas limit 2300)

**Q: payToken (ERC-20)?**
- ใช้ `SafeERC20.safeTransferFrom` — รองรับ non-standard tokens (เช่น USDT)
- Payer ต้อง approve ก่อน

**Q: Events?**
| Event | เมื่อไหร่ |
|-------|----------|
| `NativePayment` | จ่าย ETH |
| `TokenPayment` | จ่าย ERC-20 |
| `FeeRateUpdated` | เปลี่ยน fee rate |
| `CompanyWalletUpdated` | เปลี่ยน wallet |

**Q: Admin functions?**
- `setFeeRate(uint256)` — 0–1000 bp
- `setCompanyWallet(address)` — เปลี่ยน company wallet

---

## 🧪 Testing

**Q: Property-Based Testing คืออะไร?**
- แทนที่จะเขียน test case เฉพาะ → เขียน **property** ที่ต้องจริงสำหรับ **ทุก input**
- `fast-check` generate random inputs 100+ ครั้ง → จับ edge cases ที่คิดไม่ถึง

**Q: PBT vs Unit Test?**
| | Unit Test | PBT |
|---|-----------|-----|
| Input | เลือกเอง | Random |
| จำนวน | 5–10 cases | 100+ cases |
| จุดแข็ง | ชัดเจน อ่านง่าย | จับ edge cases |

**Q: Properties ที่ test?**
| Domain | Property |
|--------|----------|
| Fee | `fee + net === total`, `fee >= 0`, `fee <= total` |
| HMAC | sign → verify = true, tamper → verify = false |
| Validation | valid address → pass, invalid → fail, token whitelist |
| Rate Limit | req ≤ limit → ok, req > limit → 429, window reset → ok |
| Self-Pay | case-insensitive match, undefined → false |
| Encode/Decode | `decode(encode(data)) === data` |
| Tampered UI | tampered → BlockedScreen, ok → Payment Card |
| Fee Aggregation | sum of parts === total per token |

---

## 🌐 UX & i18n

**Q: ทำไมเลือก QR + link?**
- Target user คุ้นเคย PromptPay — scan แล้วจ่าย
- ลดจาก 6+ steps เหลือ 2 steps (scan → pay)
- แชร์ผ่าน LINE, Discord, Telegram ได้เลย

**Q: รองรับ mobile?**
- Responsive (Tailwind), RainbowKit รองรับ mobile wallets

**Q: i18n?**
- ไทย + อังกฤษ, switch ทันทีผ่าน Navbar toggle
- ใช้ React Context + localStorage, ทุก text ใช้ `t.xxx`

**Q: OG tags?**
- Next.js `generateMetadata` (server-side) → decode link data → generate og:title, og:description
- แชร์ใน LINE/Discord เห็น preview card สวยๆ

---

## 📊 Dashboard & API

**Q: TX history ดึงยังไง?**
- `GET /api/tx/[address]` → ดึง 3 ประเภทจาก Basescan พร้อมกัน:
  - Normal ETH TX, Internal ETH TX (fee split), ERC-20 TX
- ใช้ `Promise.allSettled` — API ตัวไหนพังก็ได้ partial data
- Deduplicate by hash + direction, sort ล่าสุดก่อน, limit 50

**Q: Fee Dashboard ต่างจาก Dashboard ปกติ?**
| | Dashboard | Fee Dashboard |
|---|-----------|---------------|
| ข้อมูล | TX ของ user | TX ที่ส่งมาที่ company wallet |
| ต้อง connect wallet | ✅ | ❌ (ใช้ company wallet ตรง) |

---

## ⚠️ Limitations (ตอบตรงๆ)

1. **Testnet only** — ยังไม่ deploy mainnet
2. **No database** — links หายถ้า clear localStorage
3. **Rate limiting in-memory** — reset เมื่อ restart
4. **2 tokens** — ETH + USDC เท่านั้น
5. **Single chain** — Base Sepolia
6. **No notifications** — ต้อง check dashboard เอง

**Q: เทียบกับ Request Network / Superfluid?**
- Request = invoicing/accounting, Superfluid = streaming payments
- เรา = peer-to-peer simplicity แบบ PromptPay — คนละ use case

**Q: ถ้า Vercel ล่ม?**
- Frontend ล่ม แต่ contract ยังทำงาน — interact ผ่าน Basescan ได้ตรง
- เงินไม่หาย เพราะ contract เป็น pass-through

---

## 🔄 Error Handling & Fallback

**Q: ถ้า contract ยังไม่ deploy?**
- Fallback: direct transfer (ไม่มี fee, ไม่ผ่าน contract)

**Q: Error ตอน pay?**
| Error | แสดงอะไร |
|-------|---------|
| User rejected | "คุณปฏิเสธธุรกรรม" |
| Insufficient funds | "ยอดเงินไม่เพียงพอ" |
| Network error | "เกิดข้อผิดพลาดเครือข่าย" |
| อื่นๆ | "กรุณาลองใหม่" + ปุ่ม Retry |

**Q: Link expiry?**
- ตั้งได้: ไม่หมดอายุ / 1d / 7d / 30d
- หมดอายุ → หน้า ⏰ "Link expired"
- Expiry ถูก sign ใน HMAC → แก้ไม่ได้

---

## 🤖 Development Process

**Q: ใช้ AI ช่วยยังไง?**
- Kiro + Spec-Driven Development: Requirements → Design → Tasks → Execute
- สร้าง 4 specs: Security Hardening, UX Improvements, Transaction Fee, Tampered Link Blocking

---

## 🎯 Quick Numbers

| Metric | Value |
|--------|-------|
| PBT Tests | 30+ |
| Security Layers | 7 |
| Tokens | 2 (ETH, USDC) |
| Languages | 2 (TH, EN) |
| Fee Rate | 1% default, 0–10% configurable |
| Rate Limit (links) | 20 req/min |
| Rate Limit (TX) | 10 req/min |
| Max Amount | 1,000,000 |
| Memo Max | 200 chars |
| Expiry Options | None, 1d, 7d, 30d |
| Chain | Base Sepolia (84532) |
| ETH Decimals | 18 |
| USDC Decimals | 6 |
| TX History Limit | 50 records |
