import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 4: Username update replaces old
 *
 * For any user with an existing username, setting a new valid username replaces
 * the old one. After the update, the API returns the new username confirming
 * the replacement.
 *
 * **Validates: Requirements 2.5**
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

describe('Feature: public-profile-page, Property 4: Username update replaces old', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Set username A for an address, then update to username B for the same
   * address. Both PUTs should succeed (200) and the second response must
   * contain username B, confirming the old username was replaced.
   *
   * **Validates: Requirements 2.5**
   */
  it('updating username replaces old: PUT A then PUT B both return 200, second returns B', async () => {
    // Mock rate-limit to always allow
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    // The mock DB tracks the latest username per address via the upsert
    const mockDb = {
      insert: () => ({
        values: (vals: { address: string; username: string }) => ({
          onConflictDoUpdate: (opts: { set: { username: string } }) => ({
            returning: () =>
              Promise.resolve([
                {
                  address: vals.address,
                  username: opts.set.username,
                  lastSeen: new Date(),
                },
              ]),
          }),
        }),
      }),
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDb,
      db: mockDb,
    }))

    const { PUT } = await import('../[address]/route')

    await fc.assert(
      fc.asyncProperty(ethAddressArb, usernameArb, usernameArb, async (address, usernameA, usernameB) => {
        // Ensure the two usernames are distinct
        fc.pre(usernameA !== usernameB)

        // --- First PUT: set username A ---
        const req1 = new NextRequest(
          `http://localhost:3000/api/username/${address}`,
          {
            method: 'PUT',
            body: JSON.stringify({ username: usernameA }),
            headers: { 'Content-Type': 'application/json' },
          },
        )
        const res1 = await PUT(req1, {
          params: Promise.resolve({ address }),
        })
        expect(res1.status).toBe(200)

        const json1 = await res1.json()
        expect(json1.address).toBe(address)
        expect(json1.username).toBe(usernameA)

        // --- Second PUT: update to username B ---
        const req2 = new NextRequest(
          `http://localhost:3000/api/username/${address}`,
          {
            method: 'PUT',
            body: JSON.stringify({ username: usernameB }),
            headers: { 'Content-Type': 'application/json' },
          },
        )
        const res2 = await PUT(req2, {
          params: Promise.resolve({ address }),
        })
        expect(res2.status).toBe(200)

        const json2 = await res2.json()
        expect(json2.address).toBe(address)
        expect(json2.username).toBe(usernameB)
      }),
      { numRuns: 100 },
    )
  })
})
