import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 2: Username uniqueness enforcement
 *
 * For any two distinct wallet addresses attempting to set the same username,
 * the first request succeeds (200) and the second request returns a 409
 * Conflict response. The username remains assigned to the first address.
 *
 * **Validates: Requirements 1.3**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

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

describe('Feature: public-profile-page, Property 2: Username uniqueness enforcement', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Two distinct addresses setting the same username:
   * first PUT succeeds (200), second PUT returns 409 Conflict.
   *
   * We mock the DB layer so the first call upserts successfully and
   * the second call throws a PostgreSQL unique constraint violation
   * (error code 23505), which the route handler maps to 409.
   *
   * **Validates: Requirements 1.3**
   */
  it('first address succeeds, second address with same username returns 409', async () => {
    let callCount = 0

    // Mock rate-limit to always allow (avoid interference)
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    const mockDb = {
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({
            returning: () => {
              callCount++
              if (callCount % 2 === 1) {
                // First call (odd): upsert succeeds
                return Promise.resolve([
                  {
                    address: '__first__',
                    username: '__username__',
                    lastSeen: new Date(),
                  },
                ])
              }
              // Second call (even): unique constraint violation on username
              const err = new Error('duplicate key value violates unique constraint "users_username_unique"')
              ;(err as unknown as Record<string, string>).code = '23505'
              return Promise.reject(err)
            },
          }),
        }),
      }),
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDb,
      db: mockDb,
    }))

    const { PUT } = await import('../../username/[address]/route')

    await fc.assert(
      fc.asyncProperty(
        ethAddressArb,
        ethAddressArb,
        usernameArb,
        async (addressA, addressB, username) => {
          // Ensure two distinct addresses
          fc.pre(addressA.toLowerCase() !== addressB.toLowerCase())

          // --- First PUT: addressA sets the username → 200 ---
          const req1 = new NextRequest(
            `http://localhost:3000/api/username/${addressA}`,
            {
              method: 'PUT',
              body: JSON.stringify({ username }),
              headers: { 'Content-Type': 'application/json' },
            },
          )
          const res1 = await PUT(req1, {
            params: Promise.resolve({ address: addressA }),
          })
          expect(res1.status).toBe(200)

          const json1 = await res1.json()
          expect(json1.username).toBeDefined()

          // --- Second PUT: addressB tries the same username → 409 ---
          const req2 = new NextRequest(
            `http://localhost:3000/api/username/${addressB}`,
            {
              method: 'PUT',
              body: JSON.stringify({ username }),
              headers: { 'Content-Type': 'application/json' },
            },
          )
          const res2 = await PUT(req2, {
            params: Promise.resolve({ address: addressB }),
          })
          expect(res2.status).toBe(409)

          const json2 = await res2.json()
          expect(json2.error).toBe('Username already taken')
        },
      ),
      { numRuns: 100 },
    )
  })
})
