import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { generateOgMetadata } from '@/lib/og-metadata'
import { shortAddress, type PaymentLinkData } from '@/lib/encode'

/**
 * Property 7: OG metadata generation from payment data
 * Validates: Requirements 6.1, 6.2, 6.3
 */

// Arbitrary for a hex address (0x + 40 hex chars)
const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))
const arbAddress = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map((chars) => `0x${chars.join('')}`)

// Arbitrary for token symbol
const arbToken = fc.constantFrom('ETH', 'USDC')

// Arbitrary for optional amount (empty string = no amount)
const arbAmount = fc.oneof(
  fc.constant(''),
  fc.float({ min: Math.fround(0.0001), max: Math.fround(999999), noNaN: true }).map((n) => n.toFixed(4)),
)

// Arbitrary for optional memo
const arbMemo = fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 100 }))

// Arbitrary for PaymentLinkData
const arbPaymentData = fc.record({
  address: arbAddress,
  token: arbToken,
  amount: arbAmount,
  memo: arbMemo,
  chainId: fc.constant(84532),
})

describe('Property 7: OG metadata generation from payment data', () => {
  it('og:title follows the correct format based on amount presence', () => {
    fc.assert(
      fc.property(arbPaymentData, (data: PaymentLinkData) => {
        const meta = generateOgMetadata({ data, url: `/pay/test-id` })
        const ogTitle = (meta.openGraph as { title?: string })?.title ?? ''

        if (data.amount) {
          expect(ogTitle).toBe(`Pay ${data.amount} ${data.token} — Crypto Pay Link`)
        } else {
          expect(ogTitle).toBe(`Pay ${data.token} — Crypto Pay Link`)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('og:description contains memo (if present) and short recipient address', () => {
    fc.assert(
      fc.property(arbPaymentData, (data: PaymentLinkData) => {
        const meta = generateOgMetadata({ data, url: `/pay/test-id` })
        const ogDesc = (meta.openGraph as { description?: string })?.description ?? ''
        const short = shortAddress(data.address)

        expect(ogDesc).toContain(short)
        if (data.memo) {
          expect(ogDesc).toContain(data.memo)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('required OG fields are always present', () => {
    fc.assert(
      fc.property(arbPaymentData, (data: PaymentLinkData) => {
        const url = `/pay/some-id`
        const meta = generateOgMetadata({ data, url })
        const og = meta.openGraph as { title?: string; description?: string; url?: string; images?: unknown[] }

        expect(og.title).toBeTruthy()
        expect(og.description).toBeTruthy()
        expect(og.url).toBe(url)
        expect(og.images).toBeDefined()
        expect((og.images as unknown[]).length).toBeGreaterThan(0)
        expect((meta.twitter as { card?: string })?.card).toBe('summary_large_image')
      }),
      { numRuns: 100 },
    )
  })

  it('returns default metadata when data is null (decode failure)', () => {
    const meta = generateOgMetadata({ data: null, url: '/pay/bad-id' })
    const og = meta.openGraph as { title?: string; description?: string; url?: string; images?: unknown[] }

    expect(og.title).toBe('Crypto Pay Link')
    expect(og.description).toBeTruthy()
    expect(og.url).toBe('/pay/bad-id')
    expect(og.images).toBeDefined()
    expect((meta.twitter as { card?: string })?.card).toBe('summary_large_image')
  })
})
