import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { UsernameSchema } from '@/lib/validate'

/**
 * Feature: public-profile-page, Property 1: Username validation is bidirectional
 *
 * For any string, the UsernameSchema validation accepts it if and only if the
 * string is 3–30 characters long, starts with a lowercase letter, and contains
 * only lowercase alphanumeric characters and hyphens. Conversely, for any string
 * that violates any of these rules, validation must reject it.
 *
 * Validates: Requirements 1.2, 1.5
 */

/** Reference regex matching the UsernameSchema rules */
const VALID_USERNAME_RE = /^[a-z][a-z0-9-]*$/

function isValidUsername(s: string): boolean {
  return s.length >= 3 && s.length <= 30 && VALID_USERNAME_RE.test(s)
}

/** Arbitrary that produces valid usernames: 3-30 chars, starts with [a-z], rest [a-z0-9-] */
const validUsernameArb = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
      { minLength: 2, maxLength: 29 },
    ),
  )
  .map(([first, rest]) => first + rest.join(''))

describe('Feature: public-profile-page, Property 1: Username validation is bidirectional', () => {
  it('accepts all valid usernames (3-30 chars, starts with letter, lowercase alphanumeric + hyphens)', () => {
    fc.assert(
      fc.property(validUsernameArb, (username) => {
        const result = UsernameSchema.safeParse(username)
        expect(result.success, `Expected "${username}" to be accepted`).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects strings that violate any username rule (bidirectional check)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (s) => {
        const result = UsernameSchema.safeParse(s)
        if (isValidUsername(s)) {
          expect(result.success, `Expected valid "${s}" to be accepted`).toBe(true)
        } else {
          expect(result.success, `Expected invalid "${s}" to be rejected`).toBe(false)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('rejects strings that are too short (< 3 chars)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
          { minLength: 0, maxLength: 2 },
        ).map((arr) => arr.join('')),
        (s) => {
          const result = UsernameSchema.safeParse(s)
          expect(result.success, `Expected short string "${s}" to be rejected`).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects strings that are too long (> 30 chars)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 30, maxLength: 60 },
          ),
        ).map(([first, rest]) => first + rest.join('')),
        (s) => {
          const result = UsernameSchema.safeParse(s)
          expect(result.success, `Expected long string (len=${s.length}) to be rejected`).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects strings starting with a non-letter character', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom(...'0123456789-'.split('')),
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
            { minLength: 2, maxLength: 29 },
          ),
        ).map(([first, rest]) => first + rest.join('')),
        (s) => {
          const result = UsernameSchema.safeParse(s)
          expect(result.success, `Expected "${s}" starting with non-letter to be rejected`).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects strings containing uppercase or special characters', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+=[]{}|;:,.<>?/~`'.split('')),
          { minLength: 3, maxLength: 30 },
        ).map((arr) => arr.join('')),
        (s) => {
          const result = UsernameSchema.safeParse(s)
          expect(result.success, `Expected "${s}" with invalid chars to be rejected`).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
