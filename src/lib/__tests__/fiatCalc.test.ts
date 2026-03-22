import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateFiatValue } from '../fiatCalc'

describe('Feature: ux-improvements, Property 3: Fiat calculation ถูกต้อง', () => {
  /**
   * Property 3: Fiat calculation ถูกต้อง
   * For any positive amount and positive price, calculateFiatValue returns (amount × price).toFixed(2).
   * For non-positive values, it returns null.
   * Validates: Requirements 2.3
   */
  it('returns correct fiat value for positive amounts and prices', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).filter((n) => n > 0),
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).filter((n) => n > 0),
        (amount, price) => {
          const result = calculateFiatValue(amount.toString(), price)
          expect(result).not.toBeNull()
          expect(result).toBe((amount * price).toFixed(2))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns null for non-positive amounts', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: -1_000_000, max: 0, noNaN: true, noDefaultInfinity: true }),
          fc.constant(0)
        ),
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).filter((n) => n > 0),
        (amount, price) => {
          const result = calculateFiatValue(amount.toString(), price)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns null for non-positive prices', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).filter((n) => n > 0),
        fc.oneof(
          fc.double({ min: -1_000_000, max: 0, noNaN: true, noDefaultInfinity: true }),
          fc.constant(0)
        ),
        (amount, price) => {
          const result = calculateFiatValue(amount.toString(), price)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns null for invalid (non-numeric) amount strings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', 'abc', 'NaN', 'undefined', '  ', '0x1'),
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true, noDefaultInfinity: true }).filter((n) => n > 0),
        (amount, price) => {
          const result = calculateFiatValue(amount, price)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})
