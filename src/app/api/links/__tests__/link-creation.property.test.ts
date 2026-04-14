import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { encodeTransferLink, decodeTransferLink, type TransferLinkData } from '@/lib/encode'
import { signTransferLink, verifyTransferLink } from '@/lib/hmac'

/**
 * Feature: database-integration, Property 1: Payment link creation round-trip
 *
 * For any valid payment link data (valid Ethereum address, supported token,
 * chainId, amount, memo), encoding the signed data and then decoding it should
 * produce data whose fields exactly match the original input. The HMAC signature
 * should also verify successfully after the round-trip.
 *
 * **Validates: Requirements 2.1, 2.2**
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

/** Amount: empty string or positive number ≤ 1,000,000 as string */
const amountArb = fc.oneof(
  fc.constant(''),
  fc
    .double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    .filter((n) => n > 0)
    .map((n) => n.toString()),
)

/** Memo: 0-200 ASCII-safe characters (avoid surrogates that break btoa) */
const memoArb = fc.string({ minLength: 0, maxLength: 200, unit: 'grapheme' })

describe('Feature: database-integration, Property 1: Payment link creation round-trip', () => {
  /**
   * Encode → decode round-trip preserves all payment link fields.
   * **Validates: Requirements 2.1, 2.2**
   */
  it('encode then decode preserves all fields for any valid payment link data', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        (address, { chainId, token }, amount, memo) => {
          const data: TransferLinkData = { address, token, amount, memo, chainId }

          // Sign the data (mimics what POST /api/links does)
          const signature = signTransferLink(data)
          const signedData: TransferLinkData = { ...data, signature }

          // Encode to link ID (base64url)
          const linkId = encodeTransferLink(signedData)

          // linkId must be a non-empty string
          expect(linkId).toBeTruthy()
          expect(typeof linkId).toBe('string')
          expect(linkId.length).toBeGreaterThan(0)

          // Decode back
          const decoded = decodeTransferLink(linkId)
          expect(decoded).not.toBeNull()

          // All fields must match the original signed data
          expect(decoded!.address).toBe(address)
          expect(decoded!.token).toBe(token)
          expect(decoded!.amount).toBe(amount)
          expect(decoded!.memo).toBe(memo)
          expect(decoded!.chainId).toBe(chainId)
          expect(decoded!.signature).toBe(signature)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * HMAC signature remains valid after encode → decode round-trip.
   * **Validates: Requirements 2.1, 2.2**
   */
  it('HMAC signature verifies successfully after encode/decode round-trip', () => {
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

          // Round-trip through encode/decode
          const linkId = encodeTransferLink(signedData)
          const decoded = decodeTransferLink(linkId)
          expect(decoded).not.toBeNull()

          // Verify HMAC on the decoded data
          const isValid = verifyTransferLink(decoded!)
          expect(isValid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
