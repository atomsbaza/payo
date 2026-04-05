import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 14: Profile API response contains required fields
 *
 * For any existing user with a username and at least one active link, the
 * Profile API response includes: `username`, `shortAddress` (6+4 format),
 * `ensName` (string or null), and a `links` array where each link contains
 * `linkId`, `token`, `amount`, `memo`, `chainId`, and `expiresAt`.
 *
 * **Validates: Requirements 4.2, 3.1, 3.5**
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
const amountArb = fc.oneof(
  fc.constant(null),
  fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }).map(String),
)
const memoArb = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 }))
const ensNameArb = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 3, maxLength: 20 }).map((s) => `${s}.eth`),
)
const expiresAtArb = fc.oneof(
  fc.constant(null),
  // future date — always valid active link
  fc.date({ min: new Date(Date.now() + 3_600_000), max: new Date(Date.now() + 365 * 86_400_000) }),
)

// --- Tests ---

describe('Feature: public-profile-page, Property 14: Profile API response contains required fields', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Generate valid users with active links. Mock the DB to return the user
   * and links. Verify the response contains all required fields with correct
   * types and shortAddress format.
   *
   * **Validates: Requirements 4.2, 3.1, 3.5**
   */
  it('response includes username, shortAddress (6+4), ensName, and links with correct shape', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        ethAddressArb,
        ensNameArb,
        fc.array(
          fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb, expiresAtArb),
          { minLength: 1, maxLength: 8 },
        ),
        async (slug, address, ensName, linkTuples) => {
          vi.resetModules()

          const dbLinks = linkTuples.map(([linkId, token, chainId, amount, memo, expiresAt]) => ({
            linkId,
            token,
            amount,
            memo,
            chainId,
            expiresAt,
          }))

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
                            { address, username: slug, ensName },
                          ]),
                      }
                    }
                    return Promise.resolve(dbLinks)
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

          // --- Top-level required fields ---

          // username must be a string matching the slug
          expect(json).toHaveProperty('username')
          expect(typeof json.username).toBe('string')
          expect(json.username).toBe(slug)

          // shortAddress: starts with "0x", contains "...", total length 13 (6 + 3 + 4)
          expect(json).toHaveProperty('shortAddress')
          expect(typeof json.shortAddress).toBe('string')
          expect(json.shortAddress).toHaveLength(13)
          expect(json.shortAddress.startsWith('0x')).toBe(true)
          expect(json.shortAddress).toContain('...')
          // Verify it matches the address: first 6 chars + "..." + last 4 chars
          expect(json.shortAddress).toBe(
            address.slice(0, 6) + '...' + address.slice(-4),
          )

          // ensName must be a string or null
          expect(json).toHaveProperty('ensName')
          if (json.ensName !== null) {
            expect(typeof json.ensName).toBe('string')
          }
          expect(json.ensName).toBe(ensName)

          // links must be an array
          expect(json).toHaveProperty('links')
          expect(Array.isArray(json.links)).toBe(true)
          expect(json.links.length).toBe(dbLinks.length)

          // --- Link-level required fields ---
          const REQUIRED_LINK_KEYS = ['linkId', 'token', 'amount', 'memo', 'chainId', 'expiresAt']

          for (const link of json.links) {
            // Every required key must be present
            for (const key of REQUIRED_LINK_KEYS) {
              expect(link).toHaveProperty(key)
            }

            // linkId: string
            expect(typeof link.linkId).toBe('string')

            // token: string
            expect(typeof link.token).toBe('string')

            // amount: string or null
            if (link.amount !== null) {
              expect(typeof link.amount).toBe('string')
            }

            // memo: string or null
            if (link.memo !== null) {
              expect(typeof link.memo).toBe('string')
            }

            // chainId: number
            expect(typeof link.chainId).toBe('number')

            // expiresAt: string (ISO) or null
            if (link.expiresAt !== null) {
              expect(typeof link.expiresAt).toBe('string')
              // Must be a valid ISO date string
              expect(isNaN(Date.parse(link.expiresAt))).toBe(false)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
