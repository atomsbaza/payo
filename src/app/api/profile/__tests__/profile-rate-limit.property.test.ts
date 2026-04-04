import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 10: Profile API rate limiting
 *
 * For any IP address, after 30 GET requests to the Profile API within
 * a 60-second window, subsequent requests are rejected with a 429 status
 * until the window resets.
 *
 * **Validates: Requirements 4.6**
 */

// --- Arbitraries ---

/** Valid username slug: 3-30 chars, starts with letter, lowercase alphanumeric + hyphens */
const usernameCharArb = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''),
)
const slugArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter(
    (s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30,
  )

// --- Tests ---

describe('Feature: public-profile-page, Property 10: Profile API rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * After 30 GET requests from the same IP, the 31st request returns 429.
   * We do NOT mock the rate limiter — we use the real one (fresh per test via resetModules).
   * We mock only the DB layer so every request succeeds at the DB level.
   *
   * **Validates: Requirements 4.6**
   */
  it('rejects with 429 after 30 requests from the same IP within the rate window', async () => {
    await fc.assert(
      fc.asyncProperty(slugArb, async (slug) => {
        // Reset modules to get a fresh rate limiter for this property run
        vi.resetModules()

        // The route does two DB queries per successful request:
        // 1. select users where username = slug → .select().from().where().limit()
        // 2. select payment_links where owner + active + not expired → .select().from().where()
        // We use a queryCount to differentiate between the two.
        let queryCount = 0

        const mockDb = {
          select: () => {
            queryCount++
            const currentQuery = queryCount
            return {
              from: () => ({
                where: () => {
                  if (currentQuery % 2 === 1) {
                    // User query (odd calls) — has .limit()
                    return {
                      limit: () =>
                        Promise.resolve([
                          {
                            address: '0x1234567890abcdef1234567890abcdef12345678',
                            username: slug,
                            ensName: null,
                          },
                        ]),
                    }
                  }
                  // Links query (even calls) — returns empty array directly
                  return Promise.resolve([])
                },
              }),
            }
          },
        }

        vi.doMock('@/lib/db', () => ({
          isDatabaseConfigured: () => true,
          getDb: () => mockDb,
        }))

        const { GET } = await import('../../profile/[slug]/route')

        const consistentIp = '192.168.1.42'

        // First 30 requests should succeed (200)
        for (let i = 0; i < 30; i++) {
          const req = new NextRequest(
            `http://localhost:3000/api/profile/${slug}`,
            {
              method: 'GET',
              headers: { 'x-forwarded-for': consistentIp },
            },
          )
          const res = await GET(req, {
            params: Promise.resolve({ slug }),
          })
          expect(res.status).toBe(200)
        }

        // 31st request should be rate limited (429)
        const req31 = new NextRequest(
          `http://localhost:3000/api/profile/${slug}`,
          {
            method: 'GET',
            headers: { 'x-forwarded-for': consistentIp },
          },
        )
        const res31 = await GET(req31, {
          params: Promise.resolve({ slug }),
        })
        expect(res31.status).toBe(429)

        const body = await res31.json()
        expect(body.error).toBe('Too many requests')

        // Verify Retry-After header is present
        const retryAfter = res31.headers.get('Retry-After')
        expect(retryAfter).toBeDefined()
        expect(Number(retryAfter)).toBeGreaterThan(0)
      }),
      { numRuns: 20 },
    )
  })
})
