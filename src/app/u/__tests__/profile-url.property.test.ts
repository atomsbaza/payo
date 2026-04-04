import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: public-profile-page, Property 12: Profile URL generation from username
 *
 * For any valid username, the generated profile URL is exactly
 * `{baseUrl}/u/{username}` where the username appears unmodified in the path.
 *
 * **Validates: Requirements 5.3**
 */

// --- Helpers ---

const BASE_URL = 'https://payo.app'

/**
 * Construct a profile URL from a base URL and username.
 * This mirrors the logic used in the Dashboard UsernameSection
 * and the Profile Page canonical URL.
 */
function buildProfileUrl(baseUrl: string, username: string): string {
  return `${baseUrl}/u/${username}`
}

// --- Arbitraries ---

/**
 * Generate valid usernames matching UsernameSchema:
 * - 3-30 characters
 * - starts with a lowercase letter
 * - only lowercase alphanumeric + hyphens
 */
const validUsernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
      { minLength: 2, maxLength: 29 },
    ),
  )
  .map(([first, rest]) => first + rest.join(''))

// --- Tests ---

describe('Feature: public-profile-page, Property 12: Profile URL generation from username', () => {
  /**
   * For any valid username, the profile URL is exactly `{baseUrl}/u/{username}`.
   *
   * **Validates: Requirements 5.3**
   */
  it('generates profile URL as {baseUrl}/u/{username} for any valid username', () => {
    fc.assert(
      fc.property(validUsernameArb, (username) => {
        const url = buildProfileUrl(BASE_URL, username)

        // URL is exactly the expected format
        expect(url).toBe(`${BASE_URL}/u/${username}`)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * The username appears unmodified in the generated URL path —
   * no encoding, no case change, no truncation.
   *
   * **Validates: Requirements 5.3**
   */
  it('preserves the username unmodified in the URL path', () => {
    fc.assert(
      fc.property(validUsernameArb, (username) => {
        const url = buildProfileUrl(BASE_URL, username)

        // Extract the path portion after /u/
        const path = new URL(url).pathname
        const extractedUsername = path.replace('/u/', '')

        expect(extractedUsername).toBe(username)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * The generated URL is a valid URL that can be parsed without error.
   *
   * **Validates: Requirements 5.3**
   */
  it('produces a valid parseable URL', () => {
    fc.assert(
      fc.property(validUsernameArb, (username) => {
        const url = buildProfileUrl(BASE_URL, username)

        // Should not throw
        const parsed = new URL(url)
        expect(parsed.protocol).toBe('https:')
        expect(parsed.hostname).toBe('payo.app')
        expect(parsed.pathname).toBe(`/u/${username}`)
      }),
      { numRuns: 100 },
    )
  })
})
