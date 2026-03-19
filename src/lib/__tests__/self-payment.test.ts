import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isSelfPayment } from '../self-payment'

// Feature: security-hardening, Property 8: Self-payment detection เป็น case-insensitive
// Validates: Requirements 6.1, 6.3

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc.array(hexCharArb, { minLength: 40, maxLength: 40 }).map(chars => `0x${chars.join('')}`)

// Randomize case of each character in a hex string
const randomCaseArb = (addr: string) =>
  fc.array(fc.boolean(), { minLength: addr.length, maxLength: addr.length }).map(flags =>
    [...addr].map((c, i) => (flags[i] ? c.toUpperCase() : c.toLowerCase())).join('')
  )

describe('Property 8: Self-payment detection is case-insensitive', () => {
  it('returns true when addresses match regardless of case', () => {
    fc.assert(
      fc.property(ethAddressArb, (addr) => {
        // Generate two differently-cased versions of the same address
        const upper = addr.toUpperCase()
        const lower = addr.toLowerCase()
        expect(isSelfPayment(upper, lower)).toBe(true)
        expect(isSelfPayment(lower, upper)).toBe(true)
        expect(isSelfPayment(addr, addr)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('returns false when addresses differ', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        ethAddressArb,
        (a, b) => {
          fc.pre(a.toLowerCase() !== b.toLowerCase())
          expect(isSelfPayment(a, b)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns false when connectedAddress is undefined', () => {
    fc.assert(
      fc.property(ethAddressArb, (addr) => {
        expect(isSelfPayment(undefined, addr)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})
