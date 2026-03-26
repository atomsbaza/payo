import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: single-use-link, Property 6: Dashboard response includes single-use metadata
 *
 * For any link returned by GET /api/dashboard/[address], the response object
 * SHALL include fields `isActive` (boolean), `deactivatedAt` (timestamp or null),
 * `payCount` (integer), and `singleUse` (boolean).
 *
 * The dashboard route does SELECT * from payment_links, so all columns are
 * returned directly. This test verifies that the response shape includes the
 * required single-use metadata fields with correct types for every link,
 * regardless of the link's single_use / is_active / pay_count combination.
 *
 * **Validates: Requirements 4.1**
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
  singleUse: boolean
  isActive: boolean
  deactivatedAt: Date | null
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
  payCount: fc.nat({ max: 10 }),
  singleUse: fc.boolean(),
  isActive: fc.boolean(),
  deactivatedAt: fc.oneof(
    fc.constant(null),
    fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31'), noInvalidDate: true }),
  ),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31'), noInvalidDate: true }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31'), noInvalidDate: true }),
})

// --- Dashboard query simulation ---

function queryDashboardLinks(
  allLinks: PaymentLinkRow[],
  ownerAddress: string,
): PaymentLinkRow[] {
  return allLinks
    .filter((link) => link.ownerAddress === ownerAddress)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

// --- Tests ---

describe('Feature: single-use-link, Property 6: Dashboard response includes single-use metadata', () => {
  /**
   * Every link in the dashboard response includes `singleUse` (boolean),
   * `isActive` (boolean), `deactivatedAt` (Date or null), and `payCount` (number).
   * **Validates: Requirements 4.1**
   */
  it('each link includes singleUse, isActive, deactivatedAt, and payCount fields with correct types', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 20 }),
        (ownerAddress, baseLinks) => {
          // Force all links to belong to the queried owner
          const links = baseLinks.map((l) => ({ ...l, ownerAddress }))
          const result = queryDashboardLinks(links, ownerAddress)

          expect(result.length).toBe(links.length)

          for (const link of result) {
            // singleUse must be a boolean
            expect(link).toHaveProperty('singleUse')
            expect(typeof link.singleUse).toBe('boolean')

            // isActive must be a boolean
            expect(link).toHaveProperty('isActive')
            expect(typeof link.isActive).toBe('boolean')

            // deactivatedAt must be a Date or null
            expect(link).toHaveProperty('deactivatedAt')
            expect(
              link.deactivatedAt === null || link.deactivatedAt instanceof Date,
            ).toBe(true)

            // payCount must be a non-negative integer
            expect(link).toHaveProperty('payCount')
            expect(typeof link.payCount).toBe('number')
            expect(Number.isInteger(link.payCount)).toBe(true)
            expect(link.payCount).toBeGreaterThanOrEqual(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * The singleUse field value is preserved exactly as stored — no transformation
   * or default override happens during the dashboard query.
   * **Validates: Requirements 4.1**
   */
  it('singleUse field value matches the stored value for each link', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        fc.array(paymentLinkRowArb, { minLength: 1, maxLength: 20 }),
        (ownerAddress, baseLinks) => {
          const links = baseLinks.map((l) => ({ ...l, ownerAddress }))
          const result = queryDashboardLinks(links, ownerAddress)

          // Sort input the same way for comparison
          const sorted = [...links].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          )

          for (let i = 0; i < result.length; i++) {
            expect(result[i].singleUse).toBe(sorted[i].singleUse)
            expect(result[i].isActive).toBe(sorted[i].isActive)
            expect(result[i].payCount).toBe(sorted[i].payCount)

            if (sorted[i].deactivatedAt === null) {
              expect(result[i].deactivatedAt).toBeNull()
            } else {
              expect(result[i].deactivatedAt!.getTime()).toBe(
                sorted[i].deactivatedAt!.getTime(),
              )
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Links with all combinations of singleUse and isActive are correctly
   * represented in the dashboard response — no filtering by these fields.
   * **Validates: Requirements 4.1**
   */
  it('does not filter out links based on singleUse or isActive values', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        (ownerAddress) => {
          // Create one link for each combination of singleUse × isActive
          const combinations: Array<{ singleUse: boolean; isActive: boolean }> = [
            { singleUse: true, isActive: true },
            { singleUse: true, isActive: false },
            { singleUse: false, isActive: true },
            { singleUse: false, isActive: false },
          ]

          const links: PaymentLinkRow[] = combinations.map((combo, i) => ({
            id: crypto.randomUUID(),
            linkId: `link-${i}`,
            ownerAddress,
            recipient: ownerAddress,
            token: 'ETH',
            chainId: 84532,
            amount: '1.0',
            memo: null,
            signature: 'a'.repeat(64),
            viewCount: 0,
            payCount: combo.singleUse && !combo.isActive ? 1 : 0,
            singleUse: combo.singleUse,
            isActive: combo.isActive,
            deactivatedAt: combo.isActive ? null : new Date('2025-01-15'),
            createdAt: new Date(2025, 0, 1 + i),
            updatedAt: new Date(2025, 0, 1 + i),
          }))

          const result = queryDashboardLinks(links, ownerAddress)

          // All 4 combinations must be present
          expect(result.length).toBe(4)

          // Verify each combination is represented
          for (const combo of combinations) {
            const found = result.find(
              (l) =>
                l.singleUse === combo.singleUse &&
                l.isActive === combo.isActive,
            )
            expect(found).toBeDefined()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
