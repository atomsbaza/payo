import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { encodePaymentLink, decodePaymentLink, type PaymentLinkData } from '@/lib/encode'

/**
 * Feature: demo-flow-revamp, Property 1: Payment link encode/decode round-trip
 *
 * **Validates: Requirements 2.2, 6.1, 6.3**
 *
 * For any valid PaymentLinkData object (with address, token, amount, memo, chainId),
 * calling decodePaymentLink(encodePaymentLink(data)) must return an object
 * that deep equals the original data.
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Ethereum-style hex address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Token: non-empty string up to 10 chars (printable ASCII) */
const tokenCharArb = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
)
const tokenArb = fc
  .array(tokenCharArb, { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(''))

/** Amount: decimal number string like "1.2345" */
const amountArb = fc
  .float({ min: Math.fround(0.001), max: Math.fround(1000), noNaN: true })
  .map((n) => n.toFixed(4))

/** Memo: any string up to 50 chars (printable ASCII + spaces) */
const memoCharArb = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-_'.split(''),
)
const memoArb = fc
  .array(memoCharArb, { minLength: 0, maxLength: 50 })
  .map((chars) => chars.join(''))

/** Positive chain ID */
const chainIdArb = fc.integer({ min: 1, max: 999999 })

/** Valid PaymentLinkData arbitrary */
const paymentLinkDataArb: fc.Arbitrary<PaymentLinkData> = fc.record({
  address: ethAddressArb,
  token: tokenArb,
  amount: amountArb,
  memo: memoArb,
  chainId: chainIdArb,
})

describe('Property 1: Payment link encode/decode round-trip', () => {
  /**
   * Feature: demo-flow-revamp, Property 1: Payment link encode/decode round-trip
   *
   * For any valid PaymentLinkData, encode → decode must return the original data.
   */
  it('decodePaymentLink(encodePaymentLink(data)) deep equals data', () => {
    fc.assert(
      fc.property(paymentLinkDataArb, (data) => {
        const encoded = encodePaymentLink(data)
        const decoded = decodePaymentLink(encoded)

        expect(decoded).not.toBeNull()
        expect(decoded).toEqual(data)
      }),
      { numRuns: 100 },
    )
  })
})
