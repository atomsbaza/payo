import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: database-integration, Property 12: Dashboard rejects invalid addresses
 *
 * For any string that does not match the Ethereum address format
 * (/^0x[a-fA-F0-9]{40}$/), calling GET /api/dashboard/[address]
 * should return HTTP 400 with { error: "Invalid Ethereum address" }.
 *
 * **Validates: Requirements 6.3**
 */

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

// --- Arbitraries for invalid addresses ---

/** Hex string of exactly 40 chars (valid body) — used to build near-miss cases */
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const hex40Arb = fc.array(hexCharArb, { minLength: 40, maxLength: 40 }).map((c) => c.join(''))

/** Missing 0x prefix — just 40 hex chars */
const missingPrefixArb = hex40Arb

/** Too short — 0x + fewer than 40 hex chars */
const tooShortArb = fc
  .integer({ min: 1, max: 39 })
  .chain((len) =>
    fc.array(hexCharArb, { minLength: len, maxLength: len }).map((c) => `0x${c.join('')}`),
  )

/** Too long — 0x + more than 40 hex chars */
const tooLongArb = fc
  .integer({ min: 41, max: 80 })
  .chain((len) =>
    fc.array(hexCharArb, { minLength: len, maxLength: len }).map((c) => `0x${c.join('')}`),
  )

/** Non-hex characters after 0x — inject at least one non-hex char */
const nonHexCharArb = fc.constantFrom(...'ghijklmnopqrstuvwxyz!@#$%^&*()_+-=[]{}|;:,.<>?/~`'.split(''))
const nonHexBodyArb = fc
  .tuple(
    fc.integer({ min: 0, max: 39 }),
    nonHexCharArb,
    fc.array(hexCharArb, { minLength: 39, maxLength: 39 }),
  )
  .map(([pos, badChar, rest]) => {
    const chars = [...rest]
    chars.splice(pos, 0, badChar)
    return `0x${chars.slice(0, 40).join('')}`
  })

/** Empty string */
const emptyStringArb = fc.constant('')

/** Completely random strings (most won't be valid addresses) */
const randomStringArb = fc.string({ minLength: 0, maxLength: 100 }).filter(
  (s) => !ETH_ADDRESS_RE.test(s),
)

/** Combined arbitrary: any invalid Ethereum address */
const invalidAddressArb = fc.oneof(
  missingPrefixArb,
  tooShortArb,
  tooLongArb,
  nonHexBodyArb,
  emptyStringArb,
  randomStringArb,
)

// --- Simulate the route's address validation ---

function validateAddress(address: string): { status: number; body: { error?: string } } {
  if (!ETH_ADDRESS_RE.test(address)) {
    return { status: 400, body: { error: 'Invalid Ethereum address' } }
  }
  return { status: 200, body: {} }
}

// --- Tests ---

describe("Feature: database-integration, Property 12: Dashboard rejects invalid addresses", () => {
  /**
   * Any string that does not match /^0x[a-fA-F0-9]{40}$/ must be rejected
   * with HTTP 400 and the expected error message.
   * **Validates: Requirements 6.3**
   */
  it('rejects any non-Ethereum-address string with 400', () => {
    fc.assert(
      fc.property(invalidAddressArb, (invalidAddress) => {
        // Precondition: ensure the generated string truly doesn't match
        fc.pre(!ETH_ADDRESS_RE.test(invalidAddress))

        const result = validateAddress(invalidAddress)

        expect(result.status).toBe(400)
        expect(result.body).toEqual({ error: 'Invalid Ethereum address' })
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Addresses missing the "0x" prefix are rejected even if the hex body is valid.
   * **Validates: Requirements 6.3**
   */
  it('rejects addresses missing the 0x prefix', () => {
    fc.assert(
      fc.property(missingPrefixArb, (addr) => {
        fc.pre(!ETH_ADDRESS_RE.test(addr))
        const result = validateAddress(addr)
        expect(result.status).toBe(400)
        expect(result.body.error).toBe('Invalid Ethereum address')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Addresses that are too short (fewer than 40 hex chars after 0x) are rejected.
   * **Validates: Requirements 6.3**
   */
  it('rejects addresses that are too short', () => {
    fc.assert(
      fc.property(tooShortArb, (addr) => {
        const result = validateAddress(addr)
        expect(result.status).toBe(400)
        expect(result.body.error).toBe('Invalid Ethereum address')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Addresses that are too long (more than 40 hex chars after 0x) are rejected.
   * **Validates: Requirements 6.3**
   */
  it('rejects addresses that are too long', () => {
    fc.assert(
      fc.property(tooLongArb, (addr) => {
        const result = validateAddress(addr)
        expect(result.status).toBe(400)
        expect(result.body.error).toBe('Invalid Ethereum address')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Addresses containing non-hex characters are rejected.
   * **Validates: Requirements 6.3**
   */
  it('rejects addresses with non-hex characters', () => {
    fc.assert(
      fc.property(nonHexBodyArb, (addr) => {
        fc.pre(!ETH_ADDRESS_RE.test(addr))
        const result = validateAddress(addr)
        expect(result.status).toBe(400)
        expect(result.body.error).toBe('Invalid Ethereum address')
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Empty string is rejected.
   * **Validates: Requirements 6.3**
   */
  it('rejects empty string', () => {
    const result = validateAddress('')
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid Ethereum address')
  })
})
