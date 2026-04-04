import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 7: Non-existent slug returns 404
 *
 * For any slug string that is valid in format but does not correspond to any
 * user in the database, the Profile API returns a 404 Not Found response.
 *
 * **Validates: Requirements 3.4, 4.3**
 */

// --- Arbitraries ---

/** Valid username: 3-30 chars, starts with letter, lowercase alphanumeric + hyphens */
const usernameCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''))
const usernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30)

// --- Tests ---

describe('Feature: public-profile-page, Property 7: Non-existent slug returns 404', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Generate valid-format slugs and mock the DB to return an empty array
   * (user not found). The Profile API should return 404 with
   * { error: "Profile not found" }.
   *
   * **Validates: Requirements 3.4, 4.3**
   */
  it('valid-format slug not in DB returns 404 with "Profile not found"', async () => {
    // Mock rate-limit to always allow
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    // Mock DB: user query always returns empty array (not found)
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDb,
      db: mockDb,
    }))

    const { GET } = await import('../../profile/[slug]/route')

    await fc.assert(
      fc.asyncProperty(usernameArb, async (slug) => {
        const req = new NextRequest(
          `http://localhost:3000/api/profile/${slug}`,
          { method: 'GET' },
        )

        const res = await GET(req, {
          params: Promise.resolve({ slug }),
        })

        expect(res.status).toBe(404)

        const json = await res.json()
        expect(json.error).toBe('Profile not found')
      }),
      { numRuns: 100 },
    )
  })
})
