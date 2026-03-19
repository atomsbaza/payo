import crypto from 'crypto'
import type { PaymentLinkData } from './encode'

const SECRET = process.env.HMAC_SECRET ?? 'default-dev-secret'

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
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
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
