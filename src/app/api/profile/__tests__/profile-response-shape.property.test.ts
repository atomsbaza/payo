import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 14: Profile API response contains required fields
 * **Validates: Requirements 4.2, 3.1, 3.5**
 */

const usernameCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''))
const usernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30)

const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map((chars) => `0x${chars.join('')}`)
const linkIdArb = fc.uuid()
const tokenArb = fc.constantFrom('ETH', 'USDC', 'USDT', 'DAI', 'WBTC')
const chainIdArb = fc.constantFrom(8453, 10, 42161, 84532)
const amountArb = fc.oneof(fc.constant(null), fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }).map(String))
const memoArb = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 }))
const ensNameArb = fc.oneof(fc.constant(null), fc.string({ minLength: 3, maxLength: 20 }).map((s) => `${s}.eth`))
const expiresAtArb = fc.oneof(
  fc.constant(null),
  fc.date({ min: new Date(Date.now() + 3_600_000), max: new Date(Date.now() + 365 * 86_400_000) }),
)

let mockDbInstance: { select: () => unknown }

function makeMockDb(address: string, slug: string, ensName: string | null, dbLinks: object[]) {
  let queryCount = 0
  return {
    select: () => {
      queryCount++
      const q = queryCount
      return {
        from: () => ({
          where: () => {
            if (q === 1) return { limit: () => Promise.resolve([{ address, username: slug, ensName }]) }
            return Promise.resolve(dbLinks)
          },
        }),
      }
    },
  }
}

describe('Feature: public-profile-page, Property 14: Profile API response contains required fields', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({ check: () => ({ allowed: true, retryAfter: 0 }) }),
    }))
    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDbInstance,
      db: mockDbInstance,
    }))
  })

  it('response includes username, shortAddress (6+4), ensName, and links with correct shape', async () => {
    const { GET } = await import('../[slug]/route')

    await fc.assert(
      fc.asyncProperty(
        usernameArb, ethAddressArb, ensNameArb,
        fc.array(fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb, expiresAtArb), { minLength: 1, maxLength: 8 }),
        async (slug, address, ensName, linkTuples) => {
          const dbLinks = linkTuples.map(([linkId, token, chainId, amount, memo, expiresAt]) => ({
            linkId, token, amount, memo, chainId, expiresAt,
          }))

          mockDbInstance = makeMockDb(address, slug, ensName, dbLinks)

          const req = new NextRequest(`http://localhost:3000/api/profile/${slug}`, { method: 'GET' })
          const res = await GET(req, { params: Promise.resolve({ slug }) })

          expect(res.status).toBe(200)
          const json = await res.json()

          expect(json.username).toBe(slug)
          expect(json.shortAddress).toBe(address.slice(0, 6) + '...' + address.slice(-4))
          expect(json.ensName).toBe(ensName)
          expect(Array.isArray(json.links)).toBe(true)
          expect(json.links.length).toBe(dbLinks.length)

          const REQUIRED_LINK_KEYS = ['linkId', 'token', 'amount', 'memo', 'chainId', 'expiresAt']
          for (const link of json.links) {
            for (const key of REQUIRED_LINK_KEYS) expect(link).toHaveProperty(key)
            expect(typeof link.linkId).toBe('string')
            expect(typeof link.token).toBe('string')
            expect(typeof link.chainId).toBe('number')
            if (link.expiresAt !== null) {
              expect(typeof link.expiresAt).toBe('string')
              expect(isNaN(Date.parse(link.expiresAt))).toBe(false)
            }
          }
        },
      ),
      { numRuns: 20 },
    )
  })
})
