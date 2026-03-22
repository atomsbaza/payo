import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isCompanyWallet } from '@/hooks/useIsCompanyWallet'

/**
 * Feature: fee-page-access-control, Property 1: Case-insensitive wallet comparison
 *
 * For any two address strings that are the same hex address but differ in casing
 * (e.g. 0xAbC... vs 0xabc...), isCompanyWallet must return true.
 * For any connected address, if company wallet is undefined or empty string,
 * the function must always return false.
 *
 * **Validates: Requirements 4.1, 4.2**
 */

/** Arbitrary that produces a valid 0x-prefixed hex address (42 chars). */
const hexAddress = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((hex) => `0x${hex}`)

describe('Feature: fee-page-access-control, Property 1: Case-insensitive wallet comparison', () => {
  it('same address with different casing returns true', () => {
    fc.assert(
      fc.property(hexAddress, (addr) => {
        const lower = addr.toLowerCase()
        const upper = addr.toUpperCase()
        expect(isCompanyWallet(lower, upper)).toBe(true)
        expect(isCompanyWallet(upper, lower)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('undefined companyWallet always returns false', () => {
    fc.assert(
      fc.property(hexAddress, (addr) => {
        expect(isCompanyWallet(addr, undefined)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('empty string companyWallet always returns false', () => {
    fc.assert(
      fc.property(hexAddress, (addr) => {
        expect(isCompanyWallet(addr, '')).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('undefined connectedAddress always returns false', () => {
    fc.assert(
      fc.property(hexAddress, (companyAddr) => {
        expect(isCompanyWallet(undefined, companyAddr)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('different addresses return false', () => {
    fc.assert(
      fc.property(hexAddress, hexAddress, (addrA, addrB) => {
        // Only assert when the two generated addresses actually differ
        fc.pre(addrA.toLowerCase() !== addrB.toLowerCase())
        expect(isCompanyWallet(addrA, addrB)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
