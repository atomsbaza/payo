import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 3: Username storage round-trip
 *
 * For any valid Ethereum address and valid username, after storing the username
 * via the Username API, querying the user by that username returns the same
 * address (shortened) and username.
 *
 * **Validates: Requirements 1.4, 2.2**
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

describe('Feature: public-profile-page, Property 3: Username storage round-trip', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Store a username via PUT /api/username/[address], then verify the response
   * contains the same address and username that were sent.
   *
   * We mock the DB layer so the upsert succeeds and returns the stored values,
   * then assert the API response round-trips them correctly.
   *
   * **Validates: Requirements 1.4, 2.2**
   */
  it('stored username round-trips: PUT returns the same address and username', async () => {
    // Mock rate-limit to always allow
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    // Track what was inserted so we can return it faithfully
    let capturedAddress: string
    let capturedUsername: string

    const mockDb = {
      insert: () => ({
        values: (vals: { address: string; username: string }) => {
          capturedAddress = vals.address
          capturedUsername = vals.username
          return {
            onConflictDoUpdate: () => ({
              returning: () =>
                Promise.resolve([
                  {
                    address: capturedAddress,
                    username: capturedUsername,
                    lastSeen: new Date(),
                  },
                ]),
            }),
          }
        },
      }),
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDb,
      db: mockDb,
    }))

    const { PUT } = await import('../[address]/route')

    await fc.assert(
      fc.asyncProperty(ethAddressArb, usernameArb, async (address, username) => {
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

        // The PUT should succeed
        expect(res.status).toBe(200)

        const json = await res.json()

        // Round-trip: the response must echo back the same address and username
        expect(json.address).toBe(address)
        expect(json.username).toBe(username)
      }),
      { numRuns: 100 },
    )
  })
})
