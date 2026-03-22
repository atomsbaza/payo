import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getVisibleTabs } from '../aggregation'
import { isCompanyWallet } from '@/hooks/useIsCompanyWallet'

/**
 * Feature: dashboard-fees-merge, Property 1: Fees tab visibility iff company wallet
 *
 * For any wallet address and company wallet configuration, the "fees" tab
 * should be included in the visible tabs if and only if the connected wallet
 * matches the company wallet (case-insensitive).
 *
 * Equivalently, `getVisibleTabs(isCompanyWallet(addr, companyWallet))` contains
 * `'fees'` exactly when the addresses match.
 *
 * **Validates: Requirements 1.1, 1.2, 6.1, 6.2**
 */

/** Arbitrary that produces a valid 0x-prefixed hex address (42 chars). */
const hexAddress = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((hex) => `0x${hex}`)

describe('Feature: dashboard-fees-merge, Property 1: Fees tab visibility iff company wallet', () => {
  it('fees tab visible iff addresses match (case-insensitive)', () => {
    fc.assert(
      fc.property(hexAddress, hexAddress, (connectedAddr, companyWallet) => {
        const isCompany = isCompanyWallet(connectedAddr, companyWallet)
        const tabs = getVisibleTabs(isCompany)
        const addressesMatch =
          connectedAddr.toLowerCase() === companyWallet.toLowerCase()

        if (addressesMatch) {
          expect(tabs).toContain('fees')
        } else {
          expect(tabs).not.toContain('fees')
        }
      }),
      { numRuns: 100 },
    )
  })

  it('fees tab visible when same address with mixed casing', () => {
    fc.assert(
      fc.property(hexAddress, (addr) => {
        const upper = addr.toUpperCase()
        const lower = addr.toLowerCase()

        const tabs = getVisibleTabs(isCompanyWallet(upper, lower))
        expect(tabs).toContain('fees')
      }),
      { numRuns: 100 },
    )
  })

  it('fees tab hidden when connected address is undefined', () => {
    fc.assert(
      fc.property(hexAddress, (companyWallet) => {
        const tabs = getVisibleTabs(isCompanyWallet(undefined, companyWallet))
        expect(tabs).not.toContain('fees')
      }),
      { numRuns: 100 },
    )
  })

  it('fees tab hidden when company wallet is undefined', () => {
    fc.assert(
      fc.property(hexAddress, (connectedAddr) => {
        const tabs = getVisibleTabs(isCompanyWallet(connectedAddr, undefined))
        expect(tabs).not.toContain('fees')
      }),
      { numRuns: 100 },
    )
  })

  it('base tabs always present regardless of company wallet status', () => {
    fc.assert(
      fc.property(fc.boolean(), (isCompany) => {
        const tabs = getVisibleTabs(isCompany)
        expect(tabs).toContain('links')
        expect(tabs).toContain('history')
      }),
      { numRuns: 100 },
    )
  })
})
