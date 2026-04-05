import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 6: Username API rate limiting
 * **Validates: Requirements 2.4**
 */

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const usernameCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''))
const usernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30)

describe('Feature: public-profile-page, Property 6: Username API rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => ({
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => ({
              returning: () => Promise.resolve([{ address: '0x0', username: 'test', lastSeen: new Date() }]),
            }),
          }),
        }),
      }),
    }))
  })

  /**
   * After 5 PUT requests for the same address, the 6th returns 429.
   * We import the module ONCE per property run so the rate limiter state persists.
   */
  it('rejects with 429 after 5 requests for the same address within the rate window', async () => {
    await fc.assert(
      fc.asyncProperty(ethAddressArb, usernameArb, async (address, username) => {
        // Fresh module per property run — fresh rate limiter state
        vi.resetModules()
        vi.doMock('@/lib/db', () => ({
          isDatabaseConfigured: () => true,
          getDb: () => ({
            insert: () => ({
              values: () => ({
                onConflictDoUpdate: () => ({
                  returning: () => Promise.resolve([{ address, username, lastSeen: new Date() }]),
                }),
              }),
            }),
          }),
        }))

        const { PUT } = await import('../[address]/route')

        const makeReq = () => new NextRequest(
          `http://localhost:3000/api/username/${address}`,
          { method: 'PUT', body: JSON.stringify({ username }), headers: { 'Content-Type': 'application/json' } },
        )

        // First 5 should succeed
        for (let i = 0; i < 5; i++) {
          const res = await PUT(makeReq(), { params: Promise.resolve({ address }) })
          expect(res.status).toBe(200)
        }

        // 6th should be rate limited
        const res6 = await PUT(makeReq(), { params: Promise.resolve({ address }) })
        expect(res6.status).toBe(429)
        const body = await res6.json()
        expect(body.error).toBe('Too many requests')
        expect(Number(res6.headers.get('Retry-After'))).toBeGreaterThan(0)
      }),
      { numRuns: 5 }, // low runs — each run does 6 HTTP calls
    )
  })
})
