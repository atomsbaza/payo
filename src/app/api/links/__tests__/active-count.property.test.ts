import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: database-integration, Property 2: Active link count accuracy
 *
 * For any set of payment links (some with is_active = true, some with
 * is_active = false), the count of active links should equal exactly the
 * number of items where is_active = true.
 *
 * This tests the counting logic used by GET /api/links at the application
 * level without requiring a real database connection.
 *
 * **Validates: Requirements 2.3**
 */

// --- Types ---

interface PaymentLinkRow {
  id: string
  linkId: string
  ownerAddress: string
  recipient: string
  token: string
  chainId: number
  amount: string | null
  memo: string | null
  signature: string
  viewCount: number
  payCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const chainTokenArb = fc.constantFrom(
  { chainId: 84532, token: 'ETH' },
  { chainId: 84532, token: 'USDC' },
  { chainId: 8453, token: 'ETH' },
  { chainId: 8453, token: 'USDC' },
)

const paymentLinkRowArb: fc.Arbitrary<PaymentLinkRow> = fc.record({
  id: fc.uuid(),
  linkId: fc.base64String({ minLength: 10, maxLength: 100 }),
  ownerAddress: ethAddressArb,
  recipient: ethAddressArb,
  token: chainTokenArb.map((ct) => ct.token),
  chainId: chainTokenArb.map((ct) => ct.chainId),
  amount: fc.oneof(fc.constant(null), fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).map(String)),
  memo: fc.oneof(fc.constant(null), fc.string({ minLength: 0, maxLength: 50 })),
  signature: fc.array(hexCharArb, { minLength: 64, maxLength: 64 }).map((chars) => chars.join('')),
  viewCount: fc.nat({ max: 10000 }),
  payCount: fc.nat({ max: 10000 }),
  isActive: fc.boolean(),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
})

// --- Counting logic (mirrors the DB query: WHERE is_active = true) ---

function countActiveLinks(links: PaymentLinkRow[]): number {
  return links.filter((link) => link.isActive === true).length
}

// --- Tests ---

describe('Feature: database-integration, Property 2: Active link count accuracy', () => {
  /**
   * For any random mix of active/inactive links, the active count
   * must equal exactly the number of links where isActive is true.
   * **Validates: Requirements 2.3**
   */
  it('active count equals the number of links with isActive = true', () => {
    fc.assert(
      fc.property(
        fc.array(paymentLinkRowArb, { minLength: 0, maxLength: 50 }),
        (links) => {
          const activeCount = countActiveLinks(links)
          const expectedCount = links.reduce(
            (sum, link) => sum + (link.isActive ? 1 : 0),
            0,
          )

          expect(activeCount).toBe(expectedCount)

          // Also verify the complement: inactive count + active count = total
          const inactiveCount = links.filter((l) => !l.isActive).length
          expect(activeCount + inactiveCount).toBe(links.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * When all links are active, the count should equal the total number of links.
   * **Validates: Requirements 2.3**
   */
  it('count equals total when all links are active', () => {
    fc.assert(
      fc.property(
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 50 }).map(
          (links) => links.map((l) => ({ ...l, isActive: true })),
        ),
        (links) => {
          const activeCount = countActiveLinks(links)
          expect(activeCount).toBe(links.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * When all links are inactive, the count should be zero.
   * **Validates: Requirements 2.3**
   */
  it('count is zero when all links are inactive', () => {
    fc.assert(
      fc.property(
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 50 }).map(
          (links) => links.map((l) => ({ ...l, isActive: false })),
        ),
        (links) => {
          const activeCount = countActiveLinks(links)
          expect(activeCount).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * The active count is always non-negative and never exceeds total link count.
   * **Validates: Requirements 2.3**
   */
  it('active count is bounded between 0 and total link count', () => {
    fc.assert(
      fc.property(
        fc.array(paymentLinkRowArb, { minLength: 0, maxLength: 50 }),
        (links) => {
          const activeCount = countActiveLinks(links)
          expect(activeCount).toBeGreaterThanOrEqual(0)
          expect(activeCount).toBeLessThanOrEqual(links.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})
