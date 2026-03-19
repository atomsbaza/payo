import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateFee, validateFeeRate, formatFeePercent } from '@/lib/fee'

// Feature: transaction-fee, Property 1: Fee split conservation
// Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
describe('Property 1: Fee split conservation', () => {
  it('fee + net === amount for any amount > 0 and feeRate 0–1000', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n }),
        fc.integer({ min: 0, max: 1000 }),
        (amount, feeRateInt) => {
          const feeRate = BigInt(feeRateInt)
          const { fee, net } = calculateFee(amount, feeRate)
          expect(fee + net).toBe(amount)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: transaction-fee, Property 2: Fee calculation round-trip
// Validates: Requirements 7.1, 7.2, 7.3
describe('Property 2: Fee calculation round-trip (frontend ↔ contract)', () => {
  it('fee === (amount * feeRate) / 10000n and net === amount - fee for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n }),
        fc.integer({ min: 0, max: 1000 }),
        (amount, feeRateInt) => {
          const feeRate = BigInt(feeRateInt)
          const { fee, net } = calculateFee(amount, feeRate)

          // Round-trip: frontend BigInt formula matches Solidity integer division
          const expectedFee = (amount * feeRate) / 10000n
          expect(fee).toBe(expectedFee)

          // Net is the remainder after fee deduction
          expect(net).toBe(amount - fee)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: transaction-fee, Property 5: Fee rate maximum cap
// Validates: Requirements 3.7, 3.8
describe('Property 5: Fee rate maximum cap', () => {
  it('calculateFee throws RangeError for any feeRate > 1000', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n }),
        fc.bigInt({ min: 1001n, max: 100000n }),
        (amount, feeRate) => {
          expect(() => calculateFee(amount, feeRate)).toThrow(RangeError)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('calculateFee throws RangeError for any feeRate < 0', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n }),
        fc.bigInt({ min: -100000n, max: -1n }),
        (amount, feeRate) => {
          expect(() => calculateFee(amount, feeRate)).toThrow(RangeError)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('calculateFee does NOT throw for any valid feeRate 0–1000', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n }),
        fc.integer({ min: 0, max: 1000 }),
        (amount, feeRateInt) => {
          const feeRate = BigInt(feeRateInt)
          expect(() => calculateFee(amount, feeRate)).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('validateFeeRate throws RangeError for feeRate > 1000', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1001n, max: 100000n }),
        (feeRate) => {
          expect(() => validateFeeRate(feeRate)).toThrow(RangeError)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('validateFeeRate throws RangeError for feeRate < 0', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -100000n, max: -1n }),
        (feeRate) => {
          expect(() => validateFeeRate(feeRate)).toThrow(RangeError)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('validateFeeRate does NOT throw for valid feeRate 0–1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (feeRateInt) => {
          const feeRate = BigInt(feeRateInt)
          expect(() => validateFeeRate(feeRate)).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: transaction-fee, Property 6: Fee rate percentage formatting
// Validates: Requirements 4.3
describe('Property 6: Fee rate percentage formatting', () => {
  it('output string ends with "%" for any feeRate 0–1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (feeRateInt) => {
          const result = formatFeePercent(BigInt(feeRateInt))
          expect(result.endsWith('%')).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('parsing the numeric part equals feeRate / 100 for any feeRate 0–1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (feeRateInt) => {
          const result = formatFeePercent(BigInt(feeRateInt))
          const numericPart = result.slice(0, -1) // strip trailing "%"
          const parsed = parseFloat(numericPart)
          expect(parsed).toBeCloseTo(feeRateInt / 100, 10)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Example-based tests for known values
  it('formats 100n as "1%"', () => {
    expect(formatFeePercent(100n)).toBe('1%')
  })

  it('formats 50n as "0.5%"', () => {
    expect(formatFeePercent(50n)).toBe('0.5%')
  })

  it('formats 1n as "0.01%"', () => {
    expect(formatFeePercent(1n)).toBe('0.01%')
  })

  it('formats 0n as "0%"', () => {
    expect(formatFeePercent(0n)).toBe('0%')
  })

  it('formats 1000n as "10%"', () => {
    expect(formatFeePercent(1000n)).toBe('10%')
  })
})
