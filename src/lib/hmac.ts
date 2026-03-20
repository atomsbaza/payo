import crypto from 'crypto'
import type { PaymentLinkData } from './encode'

let _secretChecked = false

function getSecret(): string {
  const secret = process.env.HMAC_SECRET
  if (!secret) {
    if (!_secretChecked) {
      console.warn(
        '⚠️ HMAC_SECRET not set — using insecure default.',
        process.env.NODE_ENV === 'production'
          ? 'THIS IS UNSAFE IN PRODUCTION. Set HMAC_SECRET in your environment variables.'
          : 'Do NOT use in production.'
      )
      _secretChecked = true
    }
    return 'default-dev-secret'
  }
  return secret
}

/**
 * สร้าง HMAC-SHA256 signature จาก payment link data
 */
export function signPaymentLink(data: Omit<PaymentLinkData, 'signature'>): string {
  const payload = JSON.stringify({
    address: data.address,
    token: data.token,
    amount: data.amount,
    memo: data.memo,
    chainId: data.chainId,
    expiresAt: data.expiresAt,
  })
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

/**
 * ตรวจสอบว่า signature ตรงกับข้อมูล
 */
export function verifyPaymentLink(
  data: PaymentLinkData & { signature?: string }
): boolean {
  if (!data.signature) return false
  const { signature, ...rest } = data
  const expected = signPaymentLink(rest)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}
