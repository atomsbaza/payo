import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: public-profile-page, Property 13: Metadata and OG tag generation
 * **Validates: Requirements 3.7, 6.2, 6.3, 6.4**
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
const linkCountArb = fc.constantFrom(0, 1, 2, 5, 10)

let mockDbInstance: { select: () => unknown }

function makeMockDb(address: string, username: string, dbLinks: object[]) {
  let queryCount = 0
  return {
    select: () => {
      queryCount++
      const q = queryCount
      return {
        from: () => ({
          where: () => {
            if (q === 1) return { limit: () => Promise.resolve([{ address, username, ensName: null }]) }
            return Promise.resolve(dbLinks)
          },
        }),
      }
    },
  }
}

describe('Feature: public-profile-page, Property 13: Metadata and OG tag generation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDbInstance,
      db: mockDbInstance,
    }))
  })

  it('generates correct title, description, OG tags, and canonical URL for any profile', async () => {
    const { generateMetadata } = await import('../[slug]/page')

    await fc.assert(
      fc.asyncProperty(
        usernameArb, ethAddressArb, linkCountArb,
        async (username, address, linkCount) => {
          const dbLinks = Array.from({ length: linkCount }, (_, i) => ({
            linkId: `link-${i}`, token: 'ETH', amount: null, memo: null, chainId: 8453, expiresAt: null,
          }))

          mockDbInstance = makeMockDb(address, username, dbLinks)

          const metadata = await generateMetadata({ params: Promise.resolve({ slug: username }) })

          const expectedTitle = `${username} — Payo`
          const expectedDescription = `${linkCount} active payment link${linkCount !== 1 ? 's' : ''}`

          expect(metadata.title).toBe(expectedTitle)
          expect(metadata.description).toBe(expectedDescription)
          expect(metadata.openGraph).toBeDefined()
          const og = metadata.openGraph as Record<string, unknown>
          expect(og.title).toBe(expectedTitle)
          expect(og.description).toBe(expectedDescription)
          expect(Array.isArray(og.images)).toBe(true)
          expect((og.images as unknown[]).length).toBeGreaterThan(0)
          expect(metadata.alternates?.canonical).toBe(`/u/${username}`)
        },
      ),
      { numRuns: 20 },
    )
  }, 30_000)
})
