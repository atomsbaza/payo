import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: public-profile-page, Property 11: Malformed slug rejection
 *
 * For any string containing characters outside the valid username format
 * (e.g. SQL injection attempts, special characters, uppercase letters,
 * strings shorter than 3 or longer than 30 characters), the Profile API
 * returns a 400 Bad Request response.
 *
 * **Validates: Requirements 7.4**
 */

// --- Arbitraries ---

/** Strings too short (0-2 chars) */
const tooShortArb = fc.string({ minLength: 0, maxLength: 2 })

/** Strings too long (31+ chars, lowercase alpha to isolate length check) */
const tooLongArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 31,
    maxLength: 60,
  })
  .map((chars) => 'a' + chars.join(''))

/** Strings with uppercase letters */
const uppercaseArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')),
      { minLength: 2, maxLength: 29 },
    ),
  )
  .map(([first, rest]) => first + rest.join(''))
  .filter((s) => /[A-Z]/.test(s))

/** Strings starting with a digit */
const startsWithDigitArb = fc
  .tuple(
    fc.constantFrom(...'0123456789'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
      { minLength: 2, maxLength: 29 },
    ),
  )
  .map(([d, rest]) => d + rest.join(''))

/** Strings starting with a hyphen */
const startsWithHyphenArb = fc
  .array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
    { minLength: 2, maxLength: 29 },
  )
  .map((rest) => '-' + rest.join(''))

/** Strings with special characters (SQL injection, symbols, etc.) */
const specialCharsArb = fc.constantFrom(
  "'; DROP TABLE users;--",
  '"; DROP TABLE users;--',
  '<script>alert(1)</script>',
  '../../../etc/passwd',
  'user@name',
  'user name',
  'user.name',
  'user/name',
  'user\\name',
  'user&name=1',
  'user?query=1',
  'user#fragment',
  'user%20name',
  '💀skull',
  'ユーザー名',
  'null\x00byte',
)

/** Random strings that don't match the username pattern */
const randomInvalidArb = fc
  .string({ minLength: 3, maxLength: 30 })
  .filter((s) => !/^[a-z][a-z0-9-]*$/.test(s))

// --- Tests ---

describe('Feature: public-profile-page, Property 11: Malformed slug rejection', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  async function setupAndGetHandler() {
    // Mock rate-limit to always allow
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    const { GET } = await import('../../profile/[slug]/route')
    return GET
  }

  async function assertMalformedSlugRejected(GET: Function, slug: string) {
    const req = new NextRequest(
      `http://localhost:3000/api/profile/${encodeURIComponent(slug)}`,
      { method: 'GET' },
    )

    const res = await GET(req, {
      params: Promise.resolve({ slug }),
    })

    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error).toBe('Invalid username format')
  }

  /**
   * Strings that are too short (0-2 chars) should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects strings shorter than 3 characters', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(tooShortArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Strings that are too long (31+ chars) should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects strings longer than 30 characters', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(tooLongArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Strings containing uppercase letters should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects strings with uppercase letters', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(uppercaseArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Strings starting with a digit should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects strings starting with a digit', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(startsWithDigitArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Strings starting with a hyphen should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects strings starting with a hyphen', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(startsWithHyphenArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * SQL injection attempts and special character strings should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects SQL injection attempts and special characters', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(specialCharsArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Random strings that don't match the username pattern should be rejected with 400.
   *
   * **Validates: Requirements 7.4**
   */
  it('rejects random strings outside the username pattern', async () => {
    const GET = await setupAndGetHandler()

    await fc.assert(
      fc.asyncProperty(randomInvalidArb, async (slug) => {
        await assertMalformedSlugRejected(GET, slug)
      }),
      { numRuns: 100 },
    )
  })
})
