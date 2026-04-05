import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 8: Active link filtering
 * **Validates: Requirements 4.4**
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
const ethAddressArb = fc
  .array(hexChar, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const linkIdArb = fc.uuid()
const tokenArb = fc.constantFrom('ETH', 'USDC', 'USDT', 'DAI', 'WBTC')
const chainIdArb = fc.constantFrom(8453, 10, 42161, 84532)
const amountArb = fc.oneof(fc.constant(null), fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }).map(String))
const memoArb = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 }))

type LinkStatus = 'active-no-expiry' | 'active-future' | 'active-expired' | 'inactive-no-expiry' | 'inactive-future' | 'inactive-expired'

const linkStatusArb: fc.Arbitrary<LinkStatus> = fc.constantFrom(
  'active-no-expiry', 'active-future', 'active-expired',
  'inactive-no-expiry', 'inactive-future', 'inactive-expired',
)

const inactiveStatusArb: fc.Arbitrary<LinkStatus> = fc.constantFrom(
  'active-expired', 'inactive-no-expiry', 'inactive-future', 'inactive-expired',
)

function buildLink(linkId: string, token: string, chainId: number, amount: string | null, memo: string | null, status: LinkStatus, now: Date) {
  const isActive = status === 'active-no-expiry' || status === 'active-future' || status === 'active-expired'
  let expiresAt: Date | null = null
  if (status.endsWith('-future')) expiresAt = new Date(now.getTime() + 86_400_000)
  else if (status.endsWith('-expired')) expiresAt = new Date(now.getTime() - 86_400_000)
  return { linkId, token, chainId, amount, memo, isActive, expiresAt }
}

function shouldBeReturned(status: LinkStatus): boolean {
  return status === 'active-no-expiry' || status === 'active-future'
}

// Shared mock state — updated per property run
let mockDbInstance: ReturnType<typeof makeMockDb>

function makeMockDb(address: string, slug: string, filteredLinks: object[]) {
  let queryCount = 0
  return {
    select: () => {
      queryCount++
      const q = queryCount
      return {
        from: () => ({
          where: () => {
            if (q === 1) return { limit: () => Promise.resolve([{ address, username: slug, ensName: null }]) }
            return Promise.resolve(filteredLinks)
          },
        }),
      }
    },
  }
}

describe('Feature: public-profile-page, Property 8: Active link filtering', () => {
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

  it('returns only active non-expired links from a mixed set', async () => {
    const { GET } = await import('../[slug]/route')

    await fc.assert(
      fc.asyncProperty(
        usernameArb, ethAddressArb,
        fc.array(fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb, linkStatusArb), { minLength: 1, maxLength: 10 }),
        async (slug, address, linkTuples) => {
          const now = new Date()
          const allLinks = linkTuples.map(([linkId, token, chainId, amount, memo, status]) =>
            buildLink(linkId, token, chainId, amount, memo, status, now))

          const filteredDbLinks = allLinks
            .filter((l) => l.isActive && (l.expiresAt === null || l.expiresAt > now))
            .map(({ linkId, token, chainId, amount, memo, expiresAt }) => ({ linkId, token, chainId, amount, memo, expiresAt }))

          const expectedIds = linkTuples
            .filter(([, , , , , status]) => shouldBeReturned(status))
            .map(([linkId]) => linkId).sort()

          mockDbInstance = makeMockDb(address, slug, filteredDbLinks)

          const req = new NextRequest(`http://localhost:3000/api/profile/${slug}`, { method: 'GET' })
          const res = await GET(req, { params: Promise.resolve({ slug }) })

          expect(res.status).toBe(200)
          const json = await res.json()
          const returnedIds = json.links.map((l: { linkId: string }) => l.linkId).sort()
          expect(returnedIds).toEqual(expectedIds)
        },
      ),
      { numRuns: 20 },
    )
  })

  it('returns empty links array when all links are inactive or expired', async () => {
    const { GET } = await import('../[slug]/route')

    await fc.assert(
      fc.asyncProperty(
        usernameArb, ethAddressArb,
        fc.array(fc.tuple(linkIdArb, tokenArb, chainIdArb, amountArb, memoArb, inactiveStatusArb), { minLength: 1, maxLength: 8 }),
        async (slug, address) => {
          mockDbInstance = makeMockDb(address, slug, [])

          const req = new NextRequest(`http://localhost:3000/api/profile/${slug}`, { method: 'GET' })
          const res = await GET(req, { params: Promise.resolve({ slug }) })

          expect(res.status).toBe(200)
          const json = await res.json()
          expect(json.links).toEqual([])
        },
      ),
      { numRuns: 20 },
    )
  })
})
