import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { encodeTransferLink, decodeTransferLink, type TransferLinkData } from '../encode'

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation — Payment Link ปกติทำงานเหมือนเดิม
 *
 * These tests verify baseline behavior that must NOT change after the demo fix.
 * They must PASS on both unfixed and fixed code.
 *
 * - Valid PaymentLinkData encode → decode roundtrip returns original data
 * - Invalid strings (not "demo", not valid base64) decode to null
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Ethereum-style hex address */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Token symbol: 2-6 uppercase letters */
const upperCharArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
const tokenSymbolArb = fc
  .array(upperCharArb, { minLength: 2, maxLength: 6 })
  .map((chars) => chars.join(''))

/** Amount: either empty string or a decimal number string */
const amountArb = fc.oneof(
  fc.constant(''),
  fc.integer({ min: 1, max: 999999 }).map((n) => (n / 10000).toString()),
)

/** Memo: printable ASCII string */
const memoCharArb = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-_'.split(''),
)
const memoArb = fc
  .array(memoCharArb, { minLength: 0, maxLength: 50 })
  .map((chars) => chars.join(''))

/** Positive chain ID */
const chainIdArb = fc.integer({ min: 1, max: 999999 })

/** Optional expiresAt: undefined or a unix timestamp in ms */
const expiresAtArb = fc.option(
  fc.integer({ min: 1_600_000_000_000, max: 2_000_000_000_000 }),
  { nil: undefined },
)

/** Valid PaymentLinkData arbitrary */
const paymentLinkDataArb: fc.Arbitrary<TransferLinkData> = fc.record({
  address: ethAddressArb,
  token: tokenSymbolArb,
  amount: amountArb,
  memo: memoArb,
  chainId: chainIdArb,
  expiresAt: expiresAtArb,
})

/**
 * Generate random strings that are NOT "demo" and NOT valid base64-encoded
 * PaymentLinkData. Uses characters that won't produce valid base64 JSON.
 */
const invalidCharArb = fc.constantFrom(
  ...'ghijklmnopqrstuvwxyz!@#$%^&*()[]{}|;:,.<>? '.split(''),
)
const invalidStringArb = fc
  .array(invalidCharArb, { minLength: 1, maxLength: 60 })
  .map((chars) => chars.join(''))
  .filter((s) => s !== 'demo')

describe('Preservation: Payment Link encode/decode baseline behavior', () => {
  /**
   * Property: For any valid PaymentLinkData, encode → decode roundtrip
   * must return the original data (all fields preserved).
   */
  it('encode → decode roundtrip preserves all PaymentLinkData fields', () => {
    fc.assert(
      fc.property(paymentLinkDataArb, (data) => {
        const encoded = encodeTransferLink(data)
        const decoded = decodeTransferLink(encoded)

        expect(decoded).not.toBe(null)
        expect(decoded!.address).toBe(data.address)
        expect(decoded!.token).toBe(data.token)
        expect(decoded!.amount).toBe(data.amount)
        expect(decoded!.memo).toBe(data.memo)
        expect(decoded!.chainId).toBe(data.chainId)
        expect(decoded!.expiresAt).toBe(data.expiresAt)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Property: For random strings that are not "demo" and not valid base64,
   * decodePaymentLink must return null.
   */
  it('decodePaymentLink returns null for invalid non-demo strings', () => {
    fc.assert(
      fc.property(invalidStringArb, (s) => {
        const result = decodeTransferLink(s)
        expect(result).toBe(null)
      }),
      { numRuns: 100 },
    )
  })
})
