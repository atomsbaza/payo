import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validatePaymentLink } from '../validate'

// Arbitrary: valid Ethereum address
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: valid PaymentLinkData
const validPaymentLinkArb = fc.record({
  address: ethAddressArb,
  token: fc.constantFrom('ETH', 'USDC'),
  amount: fc.oneof(
    fc.constant(''),
    fc.double({ min: 0.01, max: 1_000_000, noNaN: true }).map((n) => n.toString())
  ),
  memo: fc.string({ maxLength: 200 }),
  chainId: fc.constant(84532),
})

describe('validatePaymentLink', () => {
  // Property 1: Valid payment link data ผ่าน validation
  it('should accept valid payment link data', () => {
    fc.assert(
      fc.property(validPaymentLinkArb, (data) => {
        const result = validatePaymentLink(data)
        expect(result.valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  // Property 2: Invalid payment link data ถูกปฏิเสธพร้อม reason
  describe('should reject invalid data with reason', () => {
    it('rejects invalid address', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^0x[a-fA-F0-9]{40}$/.test(s)),
          (badAddress) => {
            const result = validatePaymentLink({
              address: badAddress,
              token: 'ETH',
              amount: '1',
              memo: '',
              chainId: 84532,
            })
            expect(result.valid).toBe(false)
            if (!result.valid) expect(result.reason).toBeTruthy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects unsupported token', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => s !== 'ETH' && s !== 'USDC'),
          (badToken) => {
            const result = validatePaymentLink({
              address: '0x' + 'a'.repeat(40),
              token: badToken,
              amount: '1',
              memo: '',
              chainId: 84532,
            })
            expect(result.valid).toBe(false)
            if (!result.valid) expect(result.reason).toBeTruthy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects invalid amount', () => {
      const invalidAmounts = ['abc', '-1', '0', '1000001', 'NaN']
      for (const amount of invalidAmounts) {
        const result = validatePaymentLink({
          address: '0x' + 'a'.repeat(40),
          token: 'ETH',
          amount,
          memo: '',
          chainId: 84532,
        })
        expect(result.valid).toBe(false)
        if (!result.valid) expect(result.reason).toBeTruthy()
      }
    })

    it('rejects wrong chainId', () => {
      fc.assert(
        fc.property(
          fc.integer().filter((n) => n !== 84532),
          (badChainId) => {
            const result = validatePaymentLink({
              address: '0x' + 'a'.repeat(40),
              token: 'ETH',
              amount: '1',
              memo: '',
              chainId: badChainId,
            })
            expect(result.valid).toBe(false)
            if (!result.valid) expect(result.reason).toBeTruthy()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
