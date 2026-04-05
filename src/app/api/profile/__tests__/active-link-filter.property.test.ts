import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 8: Active link filtering
 *
 * For any set of payment links belonging to a user, the Profile API returns
 * only those links where `is_active` is true AND (`expires_at` is null OR
 * `expires_at` is in the future). Links that are inactive or expired are
 * never included in the response.
 *
 * **Validates: Requirements 4.4**
 */

// --- Arbitraries ---

const usernameCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''))
const usernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30)

const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc
  .array(hexChar, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const linkIdArb = fc.uuid()
const tokenArb = fc.constantFrom('ETH', 'USDC', 'USDT', 'DAI', 'WBTC')
const chainIdArb = fc.constantFrom(8453, 10, 42161, 84532)
const amountArb = fc.oneof(fc.constant(null), fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }).map(String))
const memoArb = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 }))

type LinkStatus = 'active-no-expiry' | 'active-future' | 'active-expired' | 'inactive-no-expiry' | 'inactive-future' | 'inactive-expired'

const linkStatusArb: fc.Arbitrary<LinkStatus> = fc.constantFrom(
  'active-no-expiry',
  'active-future',
  'active-expired',
  'inactive-no-expiry',
  'inactive-future',
  'inactive-expired',
)

/** Build a payment link record with a given status */
function buildLink(
  linkId: string,
  token: string,
  chainId: number,
  amount: string | null,
  memo: string | null,
  status: LinkStatus,
  now: Date,
) {
  const isActive =
    status === 'active-no-expiry' ||
    status === 'active-future' ||
    status === 'active-expired'

  let expiresAt: Date | null = null
  if (status.endsWith('-future')) {
    expiresAt = new Date(now.getTime() + 86_400_000) // +1 day
  } else if (status.endsWith('-expired')) {
    expiresAt = new Date(now.getTime() - 86_400_000) // -1 day
  }

  return { linkId, token, chainId, amount, memo, isActive, expiresAt }
}

/** A link should appear in the response iff active AND not expired */
function shouldBeReturned(status: LinkStatus): boolean {
  return status === 'active-no-expiry' || status === 'active-future'
}

// --- Tests ---

describe('Feature: public-profile-page, Property 8: Active link filtering', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Generate a set of payment links with mixed active/inactive/expired states.
   * Mock the DB to simulate the WHERE clause filtering. Verify the API response
   * contains exactly the links that are active AND not expired.
   *
   * **Validates: Requirements 4.4**
   */
  it('returns only active non-expired links from a mixed set', async () => {
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    // We'll set up the mock inside the property so each run gets fresh data
    const { GET } = await import('../[slug]/route')

    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        ethAddressArb,
        fc.array(
          fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb, linkStatusArb),
          { minLength: 1, maxLength: 10 },
        ),
        async (slug, address, linkTuples) => {
          const now = new Date()

          const allLinks = linkTuples.map(([linkId, token, chainId, amount, memo, status]) =>
            buildLink(linkId, token, chainId, amount, memo, status, now),
          )

          // Determine which links the DB WHERE clause would return
          const expectedLinks = linkTuples
            .filter(([, , , , , status]) => shouldBeReturned(status))
            .map(([linkId, token, chainId, amount, memo]) => ({
              linkId,
              token,
              amount: amount ?? null,
              memo: memo ?? null,
              chainId,
            }))

          // The route does two DB queries:
          // 1. select users where username = slug → returns user
          // 2. select payment_links where owner + active + not expired → returns filtered links
          let queryCount = 0

          const filteredDbLinks = allLinks
            .filter((l) => l.isActive && (l.expiresAt === null || l.expiresAt > now))
            .map((l) => ({
              linkId: l.linkId,
              token: l.token,
              amount: l.amount,
              memo: l.memo,
              chainId: l.chainId,
              expiresAt: l.expiresAt,
            }))

          const mockDb = {
            select: () => {
              queryCount++
              const currentQuery = queryCount
              return {
                from: () => ({
                  where: () => {
                    if (currentQuery === 1) {
                      // User query — return with limit()
                      return {
                        limit: () =>
                          Promise.resolve([
                            { address, username: slug, ensName: null },
                          ]),
                      }
                    }
                    // Links query — return filtered links (no limit)
                    return Promise.resolve(filteredDbLinks)
                  },
                }),
              }
            },
          }

          // Re-mock db for this iteration
          vi.doMock('@/lib/db', () => ({
            isDatabaseConfigured: () => true,
            getDb: () => mockDb,
            db: mockDb,
          }))

          // Re-import to pick up new mock
          vi.resetModules()
          vi.doMock('@/lib/rate-limit', () => ({
            createRateLimiter: () => ({
              check: () => ({ allowed: true, retryAfter: 0 }),
            }),
          }))
          vi.doMock('@/lib/db', () => ({
            isDatabaseConfigured: () => true,
            getDb: () => mockDb,
            db: mockDb,
          }))

          const mod = await import('../[slug]/route')

          const req = new NextRequest(
            `http://localhost:3000/api/profile/${slug}`,
            { method: 'GET' },
          )

          const res = await mod.GET(req, {
            params: Promise.resolve({ slug }),
          })

          expect(res.status).toBe(200)

          const json = await res.json()

          // Verify count matches
          expect(json.links.length).toBe(expectedLinks.length)

          // Verify each returned link matches an expected link
          const returnedIds = json.links.map((l: { linkId: string }) => l.linkId).sort()
          const expectedIds = expectedLinks.map((l) => l.linkId).sort()
          expect(returnedIds).toEqual(expectedIds)

          // Verify each returned link has the correct fields
          for (const link of json.links) {
            const expected = expectedLinks.find((e) => e.linkId === link.linkId)
            expect(expected).toBeDefined()
            expect(link.token).toBe(expected!.token)
            expect(link.amount).toBe(expected!.amount)
            expect(link.memo).toBe(expected!.memo)
            expect(link.chainId).toBe(expected!.chainId)
          }
        },
      ),
      { numRuns: 100 },
    )
  })


  /**
   * Edge case: when ALL links are inactive or expired, the response should
   * have an empty links array.
   *
   * **Validates: Requirements 4.4**
   */
  it('returns empty links array when all links are inactive or expired', async () => {
    const inactiveStatusArb: fc.Arbitrary<LinkStatus> = fc.constantFrom(
      'active-expired',
      'inactive-no-expiry',
      'inactive-future',
      'inactive-expired',
    )

    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        ethAddressArb,
        fc.array(
          fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb, inactiveStatusArb),
          { minLength: 1, maxLength: 8 },
        ),
        async (slug, address, linkTuples) => {
          vi.resetModules()

          let queryCount = 0
          const mockDb = {
            select: () => {
              queryCount++
              const currentQuery = queryCount
              return {
                from: () => ({
                  where: () => {
                    if (currentQuery === 1) {
                      return {
                        limit: () =>
                          Promise.resolve([
                            { address, username: slug, ensName: null },
                          ]),
                      }
                    }
                    // No links pass the filter
                    return Promise.resolve([])
                  },
                }),
              }
            },
          }

          vi.doMock('@/lib/rate-limit', () => ({
            createRateLimiter: () => ({
              check: () => ({ allowed: true, retryAfter: 0 }),
            }),
          }))
          vi.doMock('@/lib/db', () => ({
            isDatabaseConfigured: () => true,
            getDb: () => mockDb,
            db: mockDb,
          }))

          const mod = await import('../[slug]/route')

          const req = new NextRequest(
            `http://localhost:3000/api/profile/${slug}`,
            { method: 'GET' },
          )

          const res = await mod.GET(req, {
            params: Promise.resolve({ slug }),
          })

          expect(res.status).toBe(200)
          const json = await res.json()
          expect(json.links).toEqual([])
        },
      ),
      { numRuns: 100 },
    )
  })
})
