import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateChainId } from '@/lib/validate'

/**
 * Feature: database-integration, Property 3: Chain ID positive constraint
 *
 * **Validates: Requirements 2.5**
 *
 * For any integer value ≤ 0 used as chain_id, validation should reject.
 * For any positive integer, validation should accept.
 */

describe('Property 3: Chain ID positive constraint', () => {
  it('rejects all non-positive integers (≤ 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 0 }),
        (chainId) => {
          const result = validateChainId(chainId)
          expect(result.valid).toBe(false)
          if (!result.valid) {
            expect(result.reason).toContain('positive integer')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts all positive integers (> 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        (chainId) => {
          const result = validateChainId(chainId)
          expect(result.valid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
