// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { render } from '@testing-library/react'

// --- Mocks ---

// Mock next/navigation
let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Mock @rainbow-me/rainbowkit
vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button">ConnectButton</div>,
}))

// Mock useIsCompanyWallet hook (uses wagmi's useAccount internally)
vi.mock('@/hooks/useIsCompanyWallet', () => ({
  useIsCompanyWallet: () => ({ isCompany: true, isConnected: true }),
}))

// Mock LangContext
vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: {
      brand: '⚡ Crypto Pay Link',
      navHome: 'Home',
      navCreateLink: '+ Create Link',
      navCompanyDashboard: 'Dashboard',
    },
    toggleLang: () => {},
  }),
}))

import { Navbar } from '../Navbar'

const VALID_PATHS = ['/', '/create', '/dashboard'] as const

describe('Navbar — Property 5: Navbar active state matches current pathname', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * Property 5: For any valid pathname in the app, the Navbar component
   * should apply active styling (text-white) to exactly the navigation link
   * corresponding to that pathname, and non-active styling (text-gray-400)
   * to all other links.
   */
  it('exactly one nav link has active styling matching the pathname', () => {
    const pathnameArb = fc.constantFrom(...VALID_PATHS)

    fc.assert(
      fc.property(pathnameArb, (pathname) => {
        mockPathname = pathname

        const { container } = render(<Navbar />)

        // Get all nav links with data-href attribute
        const links = container.querySelectorAll('a[data-href]')
        expect(links.length).toBe(3)

        let activeCount = 0
        links.forEach((link) => {
          const href = link.getAttribute('data-href')
          const classList = link.className.split(/\s+/)

          if (href === pathname) {
            // Active link should have text-white (exact class, not hover:text-white)
            expect(classList).toContain('text-white')
            expect(classList).toContain('font-semibold')
            expect(classList).not.toContain('text-gray-400')
            activeCount++
          } else {
            // Inactive links should have text-gray-400, not text-white (exact)
            expect(classList).toContain('text-gray-400')
            expect(classList).not.toContain('text-white')
            expect(classList).not.toContain('font-semibold')
          }
        })

        // Exactly one link should be active
        expect(activeCount).toBe(1)
      }),
      { numRuns: 100 }
    )
  })
})
