import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { signPaymentLink, verifyPaymentLink } from '../hmac'

// Arbitrary: valid Ethereum address
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: valid PaymentLinkData (without signature)
const validPaymentLinkArb = fc.record({
  address: ethAddressArb,
  token: fc.constantFrom('ETH', 'USDC'),
  amount: fc.oneof(
    fc.constant(''),
    fc.double({ min: 0.01, max: 1_000_000, noNaN: true }).map((n) => n.toString())
  ),
  memo: fc.string({ maxLength: 200 }),
  chainId: fc.constant(84532),
  expiresAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
})

describe('HMAC Link Integrity', () => {
  // Feature: security-hardening, Property 4: HMAC sign แล้ว verify เป็น round-trip
  // Validates: Requirements 3.1, 3.2, 3.3
  it('sign then verify is a round-trip (Property 4)', () => {
    fc.assert(
      fc.property(validPaymentLinkArb, (data) => {
        const signature = signPaymentLink(data)
        const dataWithSignature = { ...data, signature }
        expect(verifyPaymentLink(dataWithSignature)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: security-hardening, Property 5: ข้อมูลที่ถูกดัดแปลงหลัง sign ไม่ผ่าน HMAC verification
  // Validates: Requirements 3.4
  it('tampered data fails HMAC verification (Property 5)', () => {
    // Arbitrary that picks a field to tamper and produces a different value
    const tamperArb = fc.constantFrom(
      'address' as const,
      'token' as const,
      'amount' as const,
      'memo' as const,
      'chainId' as const
    )

    fc.assert(
      fc.property(validPaymentLinkArb, tamperArb, fc.string({ minLength: 1, maxLength: 50 }), (data, field, noise) => {
        const signature = signPaymentLink(data)
        const signed = { ...data, signature }

        // Create a tampered copy by modifying the chosen field
        const tampered = { ...signed }
        switch (field) {
          case 'address':
            // Flip one hex char to guarantee a different address
            tampered.address = data.address.slice(0, 2) +
              (data.address[2] === 'a' ? 'b' : 'a') +
              data.address.slice(3)
            break
          case 'token':
            tampered.token = data.token === 'ETH' ? 'USDC' : 'ETH'
            break
          case 'amount':
            tampered.amount = data.amount === '' ? '42' : ''
            break
          case 'memo':
            tampered.memo = data.memo + noise
            break
          case 'chainId':
            tampered.chainId = (data.chainId + 1) as typeof data.chainId
            break
        }

        expect(verifyPaymentLink(tampered)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})
