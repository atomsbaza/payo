import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getFilteredLinks } from '@/components/Navbar'
import { isCompanyWallet } from '@/hooks/useIsCompanyWallet'

/**
 * Feature: fee-page-access-control, Property 2: Non-company wallet does not see Fee link
 *
 * After the dashboard-fees-merge, the `/dashboard/fees` nav link has been removed entirely.
 * Fees are now a tab inside `/dashboard`. This test verifies:
 * - No wallet ever sees a `/dashboard/fees` nav link
 * - Company wallet gets the `navCompanyDashboard` label on the dashboard link
 *
 * **Validates: Requirements 1.2**
 */

/** Arbitrary that produces a valid 0x-prefixed hex address (42 chars). */
const hexAddress = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((hex) => `0x${hex}`)

describe('Feature: fee-page-access-control, Property 2: No wallet sees Fee link in Navbar (fees merged into dashboard tab)', () => {
  it('non-company wallet never sees fee link', () => {
    fc.assert(
      fc.property(hexAddress, hexAddress, (randomAddr, companyWallet) => {
        fc.pre(randomAddr.toLowerCase() !== companyWallet.toLowerCase())

        const isCompany = isCompanyWallet(randomAddr, companyWallet)
        expect(isCompany).toBe(false)

        const links = getFilteredLinks(isCompany)
        const feeLink = links.find((l) => l.href === '/dashboard/fees')
        expect(feeLink).toBeUndefined()
      }),
      { numRuns: 100 },
    )
  })

  it('company wallet does not see fee link but dashboard label changes', () => {
    fc.assert(
      fc.property(hexAddress, (addr) => {
        const isCompany = isCompanyWallet(addr, addr.toUpperCase())
        expect(isCompany).toBe(true)

        const links = getFilteredLinks(isCompany)

        // Fee link must NOT be present (fees are now a dashboard tab)
        const feeLink = links.find((l) => l.href === '/dashboard/fees')
        expect(feeLink).toBeUndefined()

        // Dashboard label must be navCompanyDashboard
        const dashLink = links.find((l) => l.href === '/dashboard')
        expect(dashLink?.labelKey).toBe('navCompanyDashboard')
      }),
      { numRuns: 100 },
    )
  })
})
