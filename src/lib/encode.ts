export type PaymentLinkData = {
  address: string
  token: string       // token symbol e.g. "ETH", "USDC"
  amount: string      // optional, empty string = let payer decide
  memo: string        // optional note
  chainId: number
  expiresAt?: number  // optional unix timestamp (ms), undefined = no expiry
  signature?: string  // HMAC-SHA256 hex string (added by server)
}

export function encodePaymentLink(data: PaymentLinkData): string {
  const json = JSON.stringify(data)
  // encodeURIComponent handles UTF-8/Thai, btoa handles Latin-1 only
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePaymentLink(id: string): PaymentLinkData | null {
  try {
    const base64 = id.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4)
    const json = decodeURIComponent(atob(padded))
    const data = JSON.parse(json) as PaymentLinkData
    if (!data.address || !data.token) return null
    return data
  } catch {
    return null
  }
}

export function isLinkExpired(data: PaymentLinkData): boolean {
  if (!data.expiresAt) return false
  return Date.now() > data.expiresAt
}

export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export const DEMO_PAYMENT_DATA: PaymentLinkData = {
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  token: 'ETH',
  amount: '0.01',
  memo: 'Demo Transfer',
  chainId: 84532,
}

export function isDemoLink(id: string): boolean {
  return id === 'demo'
}
