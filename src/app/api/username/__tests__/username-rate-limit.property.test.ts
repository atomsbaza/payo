import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 6: Username API rate limiting
 *
 * For any wallet address, after 5 PUT requests to the Username API within
 * a 60-second window, subsequent requests are rejected with a 429 status
 * until the window resets.
 *
 * **Validates: Requirements 2.4**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid username: 3-30 chars, starts with letter, lowercase alphanumeric + hyphens */
const usernameCharArb = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''),
)
const usernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter(
    (s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30,
  )

// --- Tests ---

describe('Feature: public-profile-page, Property 6: Username API rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * After 5 PUT requests for the same address, the 6th request returns 429.
   * We do NOT mock the rate limiter — we use the real one (fresh per test via resetModules).
   * We mock only the DB layer so every request succeeds at the DB level.
   *
   * **Validates: Requirements 2.4**
   */
  it('rejects with 429 after 5 requests for the same address within the rate window', async () => {
    await fc.assert(
      fc.asyncProperty(ethAddressArb, usernameArb, async (address, username) => {
        // Reset modules to get a fresh rate limiter for this property run
        vi.resetModules()

        // Mock DB to always succeed
        vi.doMock('@/lib/db', () => ({
          isDatabaseConfigured: () => true,
          getDb: () => ({
            insert: () => ({
              values: () => ({
                onConflictDoUpdate: () => ({
                  returning: () =>
                    Promise.resolve([
                      {
                        address,
                        username,
                        lastSeen: new Date(),
                      },
                    ]),
                }),
              }),
            }),
          }),
        }))

        const { PUT } = await import('../../username/[address]/route')

        // First 5 requests should succeed (200)
        for (let i = 0; i < 5; i++) {
          const req = new NextRequest(
            `http://localhost:3000/api/username/${address}`,
            {
              method: 'PUT',
              body: JSON.stringify({ username }),
              headers: { 'Content-Type': 'application/json' },
            },
          )
          const res = await PUT(req, {
            params: Promise.resolve({ address }),
          })
          expect(res.status).toBe(200)
        }

        // 6th request should be rate limited (429)
        const req6 = new NextRequest(
          `http://localhost:3000/api/username/${address}`,
          {
            method: 'PUT',
            body: JSON.stringify({ username }),
            headers: { 'Content-Type': 'application/json' },
          },
        )
        const res6 = await PUT(req6, {
          params: Promise.resolve({ address }),
        })
        expect(res6.status).toBe(429)

        const body = await res6.json()
        expect(body.error).toBe('Too many requests')

        // Verify Retry-After header is present
        const retryAfter = res6.headers.get('Retry-After')
        expect(retryAfter).toBeDefined()
        expect(Number(retryAfter)).toBeGreaterThan(0)
      }),
      { numRuns: 100 },
    )
  })
})
