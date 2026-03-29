import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: public-profile-page, Property 13: Metadata and OG tag generation
 *
 * For any valid profile with a username and N active links, the generated
 * metadata includes: a title matching "{username} — Payo", a description
 * mentioning the active link count, og:title, og:description, og:image,
 * and a canonical URL of `/u/{username}`.
 *
 * **Validates: Requirements 3.7, 6.2, 6.3, 6.4**
 */

// --- Arbitraries ---

const usernameCharArb = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''),
)
const usernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(usernameCharArb, { minLength: 2, maxLength: 29 }),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter(
    (s) => /^[a-z][a-z0-9-]*$/.test(s) && s.length >= 3 && s.length <= 30,
  )

const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc
  .array(hexChar, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const linkCountArb = fc.constantFrom(0, 1, 2, 5, 10)

const tokenArb = fc.constantFrom('ETH', 'USDC', 'USDT', 'DAI', 'WBTC')
const chainIdArb = fc.constantFrom(8453, 10, 42161, 84532)
const amountArb = fc.oneof(
  fc.constant(null),
  fc
    .float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true })
    .map(String),
)
const memoArb = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 50 }),
)

const expiresAtArb = fc.oneof(
  fc.constant(null),
  fc.date({
    min: new Date(Date.now() + 3_600_000),
    max: new Date(Date.now() + 365 * 86_400_000),
  }),
)

function buildLinks(count: number) {
  return fc
    .array(
      fc.tuple(
        fc.uuid(),
        tokenArb,
        chainIdArb,
        amountArb,
        memoArb,
        expiresAtArb,
      ),
      { minLength: count, maxLength: count },
    )
    .map((tuples) =>
      tuples.map(([linkId, token, chainId, amount, memo, expiresAt]) => ({
        linkId,
        token,
        amount,
        memo,
        chainId,
        expiresAt,
      })),
    )
}

// --- Tests ---

describe('Feature: public-profile-page, Property 13: Metadata and OG tag generation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Generate profiles with varying link counts. Mock the DB to return
   * the user and links. Call generateMetadata and verify all metadata
   * fields are correct.
   *
   * **Validates: Requirements 3.7, 6.2, 6.3, 6.4**
   */
  it('generates correct title, description, OG tags, and canonical URL for any profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        ethAddressArb,
        linkCountArb,
        async (username, address, linkCount) => {
          vi.resetModules()

          // Build mock links for this iteration
          const dbLinks = Array.from({ length: linkCount }, (_, i) => ({
            linkId: `link-${i}`,
            token: 'ETH',
            amount: i % 2 === 0 ? '1.0' : null,
            memo: i % 3 === 0 ? 'test memo' : null,
            chainId: 8453,
            expiresAt: null,
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
                            { address, username, ensName: null },
                          ]),
                      }
                    }
                    return Promise.resolve(dbLinks)
                  },
                }),
              }
            },
          }

          vi.doMock('@/lib/db', () => ({
            isDatabaseConfigured: () => true,
            getDb: () => mockDb,
            db: mockDb,
          }))

          vi.doMock('next/navigation', () => ({
            notFound: () => {
              throw new Error('NEXT_NOT_FOUND')
            },
          }))

          vi.doMock('../[slug]/ProfileClient', () => ({
            ProfileClient: () => null,
          }))

          const mod = await import('../[slug]/page')
          const metadata = await mod.generateMetadata({
            params: Promise.resolve({ slug: username }),
          })

          const expectedTitle = `${username} — Payo`
          const expectedDescription = `${linkCount} active payment link${linkCount !== 1 ? 's' : ''}`
          const expectedCanonical = `/u/${username}`

          // Title matches "{username} — Payo"
          expect(metadata.title).toBe(expectedTitle)

          // Description mentions the link count
          expect(metadata.description).toBe(expectedDescription)
          expect(metadata.description).toContain(String(linkCount))

          // OpenGraph tags present and correct
          expect(metadata.openGraph).toBeDefined()
          const og = metadata.openGraph as Record<string, unknown>
          expect(og.title).toBe(expectedTitle)
          expect(og.description).toBe(expectedDescription)
          expect(og.images).toBeDefined()
          expect(Array.isArray(og.images)).toBe(true)
          expect((og.images as string[]).length).toBeGreaterThan(0)

          // Canonical URL correct
          expect(metadata.alternates).toBeDefined()
          expect(metadata.alternates!.canonical).toBe(expectedCanonical)
        },
      ),
      { numRuns: 100 },
    )
  })
})
