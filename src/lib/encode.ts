export type PaymentLinkData = {
  address: string
  token: string       // token symbol e.g. "ETH", "USDC"
  amount: string      // optional, empty string = let payer decide
  memo: string        // optional note
  chainId: number
}

export function encodePaymentLink(data: PaymentLinkData): string {
  const json = JSON.stringify(data)
  // base64url encode (URL-safe)
  const encoded = Buffer.from(json).toString('base64url')
  return encoded
}

export function decodePaymentLink(id: string): PaymentLinkData | null {
  try {
    const json = Buffer.from(id, 'base64url').toString('utf-8')
    const data = JSON.parse(json) as PaymentLinkData
    if (!data.address || !data.token) return null
    return data
  } catch {
    return null
  }
}

export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
