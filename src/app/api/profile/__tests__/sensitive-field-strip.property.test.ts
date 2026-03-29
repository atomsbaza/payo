import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 9: Sensitive field stripping
 *
 * For any Profile API response, the response object and each link in the
 * `links` array must not contain: full wallet address (42-char hex),
 * `signature`, `ownerAddress`, internal `id` (UUID), `viewCount`, `payCount`,
 * or `isActive` fields.
 *
 * **Validates: Requirements 4.5, 7.1, 7.2**
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
const ensNameArb = fc.oneof(fc.constant(null), fc.string({ minLength: 3, maxLength: 20 }).map((s) => `${s}.eth`))


/** Full 42-char Ethereum address regex */
const FULL_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/** Sensitive fields that must NOT appear on the top-level response */
const SENSITIVE_TOP_LEVEL_KEYS = ['signature', 'ownerAddress', 'id', 'viewCount', 'payCount', 'isActive']

/** Sensitive fields that must NOT appear on any link object */
const SENSITIVE_LINK_KEYS = ['signature', 'ownerAddress', 'id', 'viewCount', 'payCount', 'isActive']

/** Allowed top-level keys in a successful profile response */
const ALLOWED_TOP_LEVEL_KEYS = ['username', 'shortAddress', 'ensName', 'links']

/** Allowed keys on each link object */
const ALLOWED_LINK_KEYS = ['linkId', 'token', 'amount', 'memo', 'chainId', 'expiresAt']

// --- Tests ---

describe('Feature: public-profile-page, Property 9: Sensitive field stripping', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Generate valid profiles with active links. Mock the DB to return a user
   * and some active links. Verify the response does NOT contain any sensitive
   * fields and DOES contain only the allowed fields.
   *
   * **Validates: Requirements 4.5, 7.1, 7.2**
   */
  it('profile response never contains sensitive fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        ethAddressArb,
        ensNameArb,
        fc.array(
          fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb),
          { minLength: 1, maxLength: 8 },
        ),
        async (slug, address, ensName, linkTuples) => {
          vi.resetModules()

          const dbLinks = linkTuples.map(([linkId, token, chainId, amount, memo]) => ({
            linkId,
            token,
            amount,
            memo,
            chainId,
            expiresAt: null, // non-expired active links
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

          const mod = await import('../../profile/[slug]/route')

          const req = new NextRequest(
            `http://localhost:3000/api/profile/${slug}`,
            { method: 'GET' },
          )

          const res = await mod.GET(req, {
            params: Promise.resolve({ slug }),
          })

          expect(res.status).toBe(200)
          const json = await res.json()

          // --- Top-level checks ---

          // Response must only contain allowed keys
          const topKeys = Object.keys(json)
          for (const key of topKeys) {
            expect(ALLOWED_TOP_LEVEL_KEYS).toContain(key)
          }

          // No sensitive fields at top level
          for (const key of SENSITIVE_TOP_LEVEL_KEYS) {
            expect(json).not.toHaveProperty(key)
          }

          // shortAddress must NOT be a full 42-char address
          expect(FULL_ADDRESS_RE.test(json.shortAddress)).toBe(false)

          // Verify no value in the top-level response is a full address
          for (const value of Object.values(json)) {
            if (typeof value === 'string') {
              expect(FULL_ADDRESS_RE.test(value)).toBe(false)
            }
          }

          // --- Link-level checks ---
          expect(Array.isArray(json.links)).toBe(true)

          for (const link of json.links) {
            // Each link must only contain allowed keys
            const linkKeys = Object.keys(link)
            for (const key of linkKeys) {
              expect(ALLOWED_LINK_KEYS).toContain(key)
            }

            // No sensitive fields on links
            for (const key of SENSITIVE_LINK_KEYS) {
              expect(link).not.toHaveProperty(key)
            }

            // No link value should be a full address
            for (const value of Object.values(link)) {
              if (typeof value === 'string') {
                expect(FULL_ADDRESS_RE.test(value)).toBe(false)
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
