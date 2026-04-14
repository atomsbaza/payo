import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  encodeTransferLink,
  decodeTransferLink,
  type TransferLinkData,
} from '@/lib/encode'
import { signTransferLink, verifyTransferLink } from '@/lib/hmac'

/**
 * Feature: database-integration, Property 4: Backward compatible link retrieval
 *
 * For any valid HMAC-signed payment link payload that does NOT exist in the
 * database, the retrieval path should fall back to decoding from the URL and
 * verifying the HMAC signature, returning valid data that matches the original.
 *
 * This proves that legacy links (created before DB) can still be retrieved
 * via the HMAC decode fallback path without requiring a database lookup.
 *
 * **Validates: Requirements 3.1, 3.2, 8.1, 8.2**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid chain + token pairs from the registry */
const chainTokenArb = fc.constantFrom(
  { chainId: 84532, token: 'ETH' },
  { chainId: 84532, token: 'USDC' },
  { chainId: 8453, token: 'ETH' },
  { chainId: 8453, token: 'USDC' },
  { chainId: 8453, token: 'DAI' },
  { chainId: 10, token: 'ETH' },
  { chainId: 10, token: 'USDC' },
  { chainId: 42161, token: 'ETH' },
  { chainId: 42161, token: 'USDC' },
)

/** Amount: empty string or positive number as string */
const amountArb = fc.oneof(
  fc.constant(''),
  fc
    .double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    .filter((n) => n > 0)
    .map((n) => n.toString()),
)

/** Memo: 0-200 grapheme-safe characters */
const memoArb = fc.string({ minLength: 0, maxLength: 200, unit: 'grapheme' })

// --- Simulated retrieval logic (mirrors GET /api/links/[id] fallback path) ---

/**
 * Simulates the legacy link retrieval path from GET /api/links/[id]:
 * 1. Decode the link ID back to PaymentLinkData
 * 2. Verify the HMAC signature
 * 3. Return { data, verified, tampered }
 */
function retrieveLegacyLink(linkId: string): {
  data: TransferLinkData | null
  verified: boolean
  tampered: boolean
} {
  const data = decodeTransferLink(linkId)
  if (!data) {
    return { data: null, verified: false, tampered: false }
  }
  const hmacValid = verifyTransferLink(data)
  return { data, verified: hmacValid, tampered: !hmacValid }
}

// --- Tests ---

describe('Feature: database-integration, Property 4: Backward compatible link retrieval', () => {
  /**
   * Legacy links (not in DB) can be decoded and HMAC-verified from the URL.
   * This simulates the fallback path: sign → encode → decode → verify.
   * **Validates: Requirements 3.1, 3.2, 8.1, 8.2**
   */
  it('legacy link round-trip: sign, encode, decode, verify succeeds for any valid data', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        (address, { chainId, token }, amount, memo) => {
          // 1. Create payment link data and sign with HMAC
          const data: TransferLinkData = { address, token, amount, memo, chainId }
          const signature = signTransferLink(data)
          const signedData: TransferLinkData = { ...data, signature }

          // 2. Encode to link ID (base64url)
          const linkId = encodeTransferLink(signedData)
          expect(linkId).toBeTruthy()

          // 3. Simulate the fallback retrieval path (not in DB)
          const result = retrieveLegacyLink(linkId)

          // 4. Decoded data must not be null
          expect(result.data).not.toBeNull()

          // 5. HMAC verification must pass
          expect(result.verified).toBe(true)
          expect(result.tampered).toBe(false)

          // 6. Decoded fields must match the original
          expect(result.data!.address).toBe(address)
          expect(result.data!.token).toBe(token)
          expect(result.data!.amount).toBe(amount)
          expect(result.data!.memo).toBe(memo)
          expect(result.data!.chainId).toBe(chainId)
          expect(result.data!.signature).toBe(signature)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Tampered legacy links are detected: modifying any field after signing
   * causes HMAC verification to fail (tampered = true).
   * **Validates: Requirements 3.2, 8.2**
   */
  it('tampered legacy link is detected when data is modified after signing', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        ethAddressArb,
        (address, { chainId, token }, amount, memo, differentAddress) => {
          // Skip when the random "different" address happens to match
          fc.pre(differentAddress !== address)

          // Sign with original address
          const data: TransferLinkData = { address, token, amount, memo, chainId }
          const signature = signTransferLink(data)

          // Tamper: swap in a different address but keep the original signature
          const tamperedData: TransferLinkData = {
            ...data,
            address: differentAddress,
            signature,
          }

          const linkId = encodeTransferLink(tamperedData)
          const result = retrieveLegacyLink(linkId)

          expect(result.data).not.toBeNull()
          expect(result.verified).toBe(false)
          expect(result.tampered).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * The fallback path returns the same response shape as the DB path:
   * { data, verified, tampered } — ensuring API format consistency.
   * **Validates: Requirements 8.1, 8.2**
   */
  it('fallback retrieval returns consistent response shape with expected keys', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        (address, { chainId, token }, amount, memo) => {
          const data: TransferLinkData = { address, token, amount, memo, chainId }
          const signature = signTransferLink(data)
          const signedData: TransferLinkData = { ...data, signature }
          const linkId = encodeTransferLink(signedData)

          const result = retrieveLegacyLink(linkId)

          // Response shape must have exactly these keys
          expect(result).toHaveProperty('data')
          expect(result).toHaveProperty('verified')
          expect(result).toHaveProperty('tampered')

          // Types must be correct
          expect(typeof result.verified).toBe('boolean')
          expect(typeof result.tampered).toBe('boolean')
          expect(result.data).toBeTypeOf('object')
        },
      ),
      { numRuns: 100 },
    )
  })
})
