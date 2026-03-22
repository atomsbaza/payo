import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

describe('Feature: ux-improvements, Property 5: Timestamp locale formatting ไม่ว่างเปล่า', () => {
  /**
   * Property 5: Timestamp locale formatting ไม่ว่างเปล่า
   *
   * For any valid timestamp (positive integer ≤ Date.now()) and for any
   * supported locale (th-TH, en-US), new Date(timestamp).toLocaleString(locale)
   * must return a non-empty string.
   *
   * **Validates: Requirements 3.2**
   */
  it('toLocaleString returns non-empty string for both th-TH and en-US locales', () => {
    const now = Date.now()

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: now }),
        fc.constantFrom('th-TH', 'en-US'),
        (timestamp, locale) => {
          const result = new Date(timestamp).toLocaleString(locale)
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
