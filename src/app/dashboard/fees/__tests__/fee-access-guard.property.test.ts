import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isCompanyWallet } from '@/hooks/useIsCompanyWallet'

/**
 * Feature: fee-page-access-control, Property 3: Non-company wallet denied access to Fee Page
 *
 * For any wallet address that does not match the Company Wallet (case-insensitive),
 * when accessing the Fee Page the system must deny access and not show fee data.
 *
 * The Fee Page guard logic (in page.tsx) uses `isCompanyWallet` to decide:
 *   - isCompany === false  → render "access denied", fee data is NOT shown
 *   - isCompany === true   → render fee dashboard with data
 *
 * This test validates the access decision function that the Fee Page relies on.
 *
 * **Validates: Requirements 2.2**
 */

/** Arbitrary that produces a valid 0x-prefixed hex address (42 chars). */
const hexAddress = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((hex) => `0x${hex}`)

describe('Feature: fee-page-access-control, Property 3: Non-company wallet denied access to Fee Page', () => {
  it('non-company wallet is denied access — isCompanyWallet returns false for mismatched addresses', () => {
    fc.assert(
      fc.property(hexAddress, hexAddress, (connectedAddr, companyWallet) => {
        // Only test when addresses differ (non-company wallet scenario)
        fc.pre(connectedAddr.toLowerCase() !== companyWallet.toLowerCase())

        const result = isCompanyWallet(connectedAddr, companyWallet)

        // Access must be denied: isCompanyWallet returns false → Fee Page shows access denied, no fee data
        expect(result).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('access denied when company wallet is undefined — fee data never shown', () => {
    fc.assert(
      fc.property(hexAddress, (connectedAddr) => {
        // When company wallet is not configured, no one can access the Fee Page
        expect(isCompanyWallet(connectedAddr, undefined)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('access denied when connected address is undefined — fee data never shown', () => {
    fc.assert(
      fc.property(hexAddress, (companyWallet) => {
        // When user has not connected a wallet, access is denied
        expect(isCompanyWallet(undefined, companyWallet)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('access granted only when addresses match (case-insensitive) — fee data shown', () => {
    fc.assert(
      fc.property(hexAddress, (addr) => {
        // Same address with different casing → access granted → Fee Page shows fee data
        const upper = addr.toUpperCase()
        const lower = addr.toLowerCase()

        expect(isCompanyWallet(upper, lower)).toBe(true)
        expect(isCompanyWallet(lower, upper)).toBe(true)
        expect(isCompanyWallet(addr, addr)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
