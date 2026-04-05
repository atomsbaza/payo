import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 9: Sensitive field stripping
 * **Validates: Requirements 4.5, 7.1, 7.2**
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

const FULL_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const SENSITIVE_KEYS = ['signature', 'ownerAddress', 'id', 'viewCount', 'payCount', 'isActive']
const ALLOWED_TOP_LEVEL_KEYS = ['username', 'shortAddress', 'ensName', 'links']
const ALLOWED_LINK_KEYS = ['linkId', 'token', 'amount', 'memo', 'chainId', 'expiresAt']

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

describe('Feature: public-profile-page, Property 9: Sensitive field stripping', () => {
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

  it('profile response never contains sensitive fields', async () => {
    const { GET } = await import('../[slug]/route')

    await fc.assert(
      fc.asyncProperty(
        usernameArb, ethAddressArb, ensNameArb,
        fc.array(fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb), { minLength: 1, maxLength: 8 }),
        async (slug, address, ensName, linkTuples) => {
          const dbLinks = linkTuples.map(([linkId, token, chainId, amount, memo]) => ({
            linkId, token, amount, memo, chainId, expiresAt: null,
          }))

          mockDbInstance = makeMockDb(address, slug, ensName, dbLinks)

          const req = new NextRequest(`http://localhost:3000/api/profile/${slug}`, { method: 'GET' })
          const res = await GET(req, { params: Promise.resolve({ slug }) })

          expect(res.status).toBe(200)
          const json = await res.json()

          // Top-level: only allowed keys
          for (const key of Object.keys(json)) expect(ALLOWED_TOP_LEVEL_KEYS).toContain(key)
          for (const key of SENSITIVE_KEYS) expect(json).not.toHaveProperty(key)
          expect(FULL_ADDRESS_RE.test(json.shortAddress)).toBe(false)

          // Links: only allowed keys, no sensitive fields
          for (const link of json.links) {
            for (const key of Object.keys(link)) expect(ALLOWED_LINK_KEYS).toContain(key)
            for (const key of SENSITIVE_KEYS) expect(link).not.toHaveProperty(key)
            for (const value of Object.values(link)) {
              if (typeof value === 'string') expect(FULL_ADDRESS_RE.test(value)).toBe(false)
            }
          }
        },
      ),
      { numRuns: 20 },
    )
  })
})
