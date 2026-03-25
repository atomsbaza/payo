import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: database-integration, Property 10: Dashboard returns owner's links with counts
 *
 * For any valid Ethereum address and any set of payment links in the database,
 * GET /api/dashboard/[address] should return exactly the links where
 * owner_address matches the requested address, ordered by created_at descending,
 * and each link should include view_count and pay_count.
 *
 * This tests the filtering, ordering, and field-inclusion logic at the
 * application level — the same invariants enforced by the SQL query:
 *   SELECT * FROM payment_links
 *   WHERE owner_address = $address
 *   ORDER BY created_at DESC
 *
 * **Validates: Requirements 6.1, 6.4**
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
  amount: fc.oneof(
    fc.constant(null),
    fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).map(String),
  ),
  memo: fc.oneof(fc.constant(null), fc.string({ minLength: 0, maxLength: 50 })),
  signature: fc.array(hexCharArb, { minLength: 64, maxLength: 64 }).map((chars) => chars.join('')),
  viewCount: fc.nat({ max: 10000 }),
  payCount: fc.nat({ max: 10000 }),
  isActive: fc.boolean(),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31'), noInvalidDate: true }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31'), noInvalidDate: true }),
})

// --- Dashboard query simulation ---
// Mirrors the SQL: SELECT * FROM payment_links WHERE owner_address = $address ORDER BY created_at DESC

function queryDashboardLinks(
  allLinks: PaymentLinkRow[],
  ownerAddress: string,
): PaymentLinkRow[] {
  return allLinks
    .filter((link) => link.ownerAddress === ownerAddress)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

// --- Tests ---

describe('Feature: database-integration, Property 10: Dashboard returns owner\'s links with counts', () => {
  /**
   * Dashboard returns only links belonging to the requested owner address.
   * No links from other owners should appear in the result.
   * **Validates: Requirements 6.1, 6.4**
   */
  it('returns exactly the links where ownerAddress matches the requested address', () => {
    fc.assert(
      fc.property(
        fc.array(paymentLinkRowArb, { minLength: 0, maxLength: 30 }),
        ethAddressArb,
        (allLinks, queryAddress) => {
          const result = queryDashboardLinks(allLinks, queryAddress)

          // Every returned link must belong to the queried address
          for (const link of result) {
            expect(link.ownerAddress).toBe(queryAddress)
          }

          // Count must match the number of links with that owner in the full set
          const expectedCount = allLinks.filter(
            (l) => l.ownerAddress === queryAddress,
          ).length
          expect(result.length).toBe(expectedCount)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Dashboard links are ordered by created_at descending (newest first).
   * **Validates: Requirements 6.1, 6.4**
   */
  it('returns links ordered by created_at descending', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        fc.array(paymentLinkRowArb, { minLength: 2, maxLength: 30 }),
        (ownerAddress, baseLinks) => {
          // Force all links to belong to the same owner so we get multiple results
          const links = baseLinks.map((l) => ({ ...l, ownerAddress }))
          const result = queryDashboardLinks(links, ownerAddress)

          // Verify descending order: each created_at >= next created_at
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
              result[i + 1].createdAt.getTime(),
            )
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Each link in the dashboard response includes view_count and pay_count fields.
   * **Validates: Requirements 6.4**
   */
  it('each returned link includes view_count and pay_count', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 20 }),
        (ownerAddress, baseLinks) => {
          const links = baseLinks.map((l) => ({ ...l, ownerAddress }))
          const result = queryDashboardLinks(links, ownerAddress)

          for (const link of result) {
            expect(link).toHaveProperty('viewCount')
            expect(link).toHaveProperty('payCount')
            expect(typeof link.viewCount).toBe('number')
            expect(typeof link.payCount).toBe('number')
            expect(link.viewCount).toBeGreaterThanOrEqual(0)
            expect(link.payCount).toBeGreaterThanOrEqual(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * When multiple owners have links, querying one owner does not return
   * links from other owners — isolation property.
   * **Validates: Requirements 6.1**
   */
  it('links from different owners are correctly isolated', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        ethAddressArb,
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 15 }),
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 15 }),
        (ownerA, ownerB, linksA, linksB) => {
          fc.pre(ownerA !== ownerB)

          const allLinks = [
            ...linksA.map((l) => ({ ...l, ownerAddress: ownerA })),
            ...linksB.map((l) => ({ ...l, ownerAddress: ownerB })),
          ]

          const resultA = queryDashboardLinks(allLinks, ownerA)
          const resultB = queryDashboardLinks(allLinks, ownerB)

          // Owner A's results must not contain owner B's links
          expect(resultA.every((l) => l.ownerAddress === ownerA)).toBe(true)
          expect(resultA.length).toBe(linksA.length)

          // Owner B's results must not contain owner A's links
          expect(resultB.every((l) => l.ownerAddress === ownerB)).toBe(true)
          expect(resultB.length).toBe(linksB.length)

          // Combined counts must equal total
          expect(resultA.length + resultB.length).toBe(allLinks.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})
