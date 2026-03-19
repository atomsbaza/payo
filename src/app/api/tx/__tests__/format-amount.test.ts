import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatUnits, parseUnits } from 'viem'

describe('ERC-20 amount formatting round trip', () => {
  /**
   * Property 2: ERC-20 amount formatting uses correct decimals
   * Validates: Requirements 2.3
   *
   * For any raw bigint value and decimal count (6 or 18),
   * formatUnits then parseUnits should return the original value.
   */
  it('formatUnits then parseUnits returns original value', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: (1n << 128n) - 1n }),
        fc.constantFrom(6, 18),
        (rawValue, decimals) => {
          const formatted = formatUnits(rawValue, decimals)
          const parsed = parseUnits(formatted, decimals)
          expect(parsed).toBe(rawValue)
        }
      ),
      { numRuns: 100 }
    )
  })
})
