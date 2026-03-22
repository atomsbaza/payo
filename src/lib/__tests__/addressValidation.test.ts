import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getAddress } from 'viem'
import { validateEthAddress } from '../addressValidation'

// Arbitrary: valid hex character
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

// Arbitrary: valid Ethereum address (0x + 40 lowercase hex chars)
const validAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: invalid strings that don't match 0x + 40 hex format
const invalidAddressArb = fc.oneof(
  // Empty string
  fc.constant(''),
  // Missing 0x prefix
  fc.array(hexCharArb, { minLength: 40, maxLength: 40 }).map((chars) => chars.join('')),
  // Too short (0x + less than 40 hex)
  fc.integer({ min: 1, max: 39 }).chain((len) =>
    fc.array(hexCharArb, { minLength: len, maxLength: len }).map((chars) => `0x${chars.join('')}`)
  ),
  // Too long (0x + more than 40 hex)
  fc.integer({ min: 41, max: 80 }).chain((len) =>
    fc.array(hexCharArb, { minLength: len, maxLength: len }).map((chars) => `0x${chars.join('')}`)
  ),
  // Contains non-hex characters
  fc.array(hexCharArb, { minLength: 39, maxLength: 39 }).chain((chars) =>
    fc.constantFrom('g', 'z', 'G', 'Z', '!', ' ').map((bad) => `0x${chars.join('')}${bad}`)
  )
)

describe('Feature: ux-improvements, Property 1: Address validation ถูกต้องตามรูปแบบ', () => {
  /**
   * Property 1: Address validation ถูกต้องตามรูปแบบ
   * For any string input, validateEthAddress returns valid: true iff input is 0x + 40 hex chars.
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  it('returns valid: true for valid 0x+40hex addresses', () => {
    fc.assert(
      fc.property(validAddressArb, (addr) => {
        const result = validateEthAddress(addr)
        expect(result.valid).toBe(true)
        expect(result.normalized).not.toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('returns valid: false for invalid addresses', () => {
    fc.assert(
      fc.property(invalidAddressArb, (addr) => {
        const result = validateEthAddress(addr)
        expect(result.valid).toBe(false)
        expect(result.normalized).toBeNull()
      }),
      { numRuns: 100 }
    )
  })
})

describe('Feature: ux-improvements, Property 2: EIP-55 checksum round-trip', () => {
  /**
   * Property 2: EIP-55 checksum round-trip
   * For any valid address, normalizing with getAddress then validating again yields checksumValid: true.
   * Validates: Requirements 1.5
   */
  it('normalized addresses always pass checksum validation', () => {
    fc.assert(
      fc.property(validAddressArb, (addr) => {
        const normalized = getAddress(addr)
        const result = validateEthAddress(normalized)
        expect(result.valid).toBe(true)
        expect(result.checksumValid).toBe(true)
        expect(result.normalized).toBe(normalized)
      }),
      { numRuns: 100 }
    )
  })
})
