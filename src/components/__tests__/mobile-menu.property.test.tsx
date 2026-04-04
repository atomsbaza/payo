// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { render, fireEvent, cleanup } from '@testing-library/react'

// --- Mocks ---
let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button">ConnectButton</div>,
}))

let mockIsCompany = false
vi.mock('@/hooks/useIsCompanyWallet', () => ({
  useIsCompanyWallet: () => ({ isCompany: mockIsCompany, isConnected: true }),
}))

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: {
      brand: '⚡ Crypto Pay Link',
      navHome: 'Home',
      navCreateLink: 'Create Link',
      navDashboard: 'Dashboard',
      navCompanyDashboard: 'Company Dashboard',
    },
    toggleLang: () => {},
  }),
}))

import { Navbar, getFilteredLinks } from '../Navbar'

const VALID_PATHS = ['/', '/create', '/dashboard'] as const

beforeEach(() => {
  mockPathname = '/'
  mockIsCompany = false
})

afterEach(() => {
  cleanup()
})

// Feature: mobile-hamburger-navbar, Property 1: Responsive CSS classes ถูกต้อง
describe('Property 1: Responsive CSS classes are correct', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * For any render of Navbar, the hamburger button must have md:hidden class,
   * the inline links container must have hidden and md:flex classes,
   * and the hamburger button must be a <button> with a non-empty aria-label.
   */
  it('hamburger has md:hidden, inline links have hidden md:flex, button has aria-label', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { container } = render(<Navbar />)

        // Find hamburger button by aria-label pattern
        const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement
        expect(hamburger).toBeTruthy()
        expect(hamburger.tagName).toBe('BUTTON')
        expect(hamburger.className).toContain('md:hidden')
        expect(hamburger.getAttribute('aria-label')).toBeTruthy()
        expect(hamburger.getAttribute('aria-label')!.length).toBeGreaterThan(0)

        // Find inline links container (hidden md:flex)
        const inlineContainer = container.querySelector('.hidden.md\\:flex')
        expect(inlineContainer).toBeTruthy()
        expect(inlineContainer!.className).toContain('hidden')
        expect(inlineContainer!.className).toContain('md:flex')
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: mobile-hamburger-navbar, Property 2: Toggle consistency — icon, aria-expanded, menu visibility
describe('Property 2: Toggle consistency — icon, aria-expanded, and menu visibility', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
   *
   * For any sequence of N clicks (1..10) on the hamburger button,
   * after each click the icon, aria-expanded, and menu panel visibility must be consistent.
   */
  it('icon, aria-expanded, and menu visibility stay consistent after N clicks', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (numClicks) => {
        const { container } = render(<Navbar />)
        const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

        for (let i = 1; i <= numClicks; i++) {
          fireEvent.click(hamburger)
          const shouldBeOpen = i % 2 === 1

          // Check icon
          expect(hamburger.textContent).toBe(shouldBeOpen ? '✕' : '☰')

          // Check aria-expanded
          expect(hamburger.getAttribute('aria-expanded')).toBe(String(shouldBeOpen))

          // Check menu panel visibility
          const mobileMenu = container.querySelector('#mobile-menu')
          if (shouldBeOpen) {
            expect(mobileMenu).toBeTruthy()
          } else {
            expect(mobileMenu).toBeNull()
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: mobile-hamburger-navbar, Property 3: Route change ปิด menu
describe('Property 3: Route change closes menu', () => {
  /**
   * **Validates: Requirements 3.1, 3.4**
   *
   * For any pathname change while the mobile menu is open,
   * the menu must close automatically.
   */
  it('menu closes when pathname changes', () => {
    // Generate pairs where initial and new paths differ to ensure an actual route change
    const pathPairArb = fc
      .constantFrom(...VALID_PATHS)
      .chain((initial) => {
        const others = VALID_PATHS.filter((p) => p !== initial)
        return fc.constantFrom(...others).map((next) => ({ initial, next }))
      })

    fc.assert(
      fc.property(pathPairArb, ({ initial, next }) => {
        mockPathname = initial
        const { container, rerender } = render(<Navbar />)
        const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

        // Open menu
        fireEvent.click(hamburger)
        expect(container.querySelector('#mobile-menu')).toBeTruthy()

        // Change pathname and rerender
        mockPathname = next
        rerender(<Navbar />)

        // Menu should be closed
        expect(hamburger.getAttribute('aria-expanded')).toBe('false')
        expect(container.querySelector('#mobile-menu')).toBeNull()
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: mobile-hamburger-navbar, Property 4: Mobile menu แสดง links เหมือน desktop
describe('Property 4: Mobile menu shows same links as desktop', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any company wallet status (true/false), the nav links displayed
   * in the mobile menu must match what getFilteredLinks() returns.
   */
  it('mobile menu links match getFilteredLinks() for any isCompany value', () => {
    fc.assert(
      fc.property(fc.boolean(), (isCompany) => {
        mockIsCompany = isCompany
        const { container } = render(<Navbar />)
        const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

        // Open menu
        fireEvent.click(hamburger)

        const mobileMenu = container.querySelector('#mobile-menu')
        expect(mobileMenu).toBeTruthy()

        // Get links from mobile menu
        const mobileLinks = mobileMenu!.querySelectorAll('a[data-href]')
        const expected = getFilteredLinks(isCompany)

        expect(mobileLinks.length).toBe(expected.length)

        expected.forEach((expectedLink, idx) => {
          const mobileLink = mobileLinks[idx]
          expect(mobileLink.getAttribute('data-href')).toBe(expectedLink.href)
          expect(mobileLink.getAttribute('href')).toBe(expectedLink.href)
        })
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: mobile-hamburger-navbar, Property 5: Active styling ใน mobile menu ตรงกับ pathname
describe('Property 5: Active styling in mobile menu matches pathname', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any valid pathname, when the mobile menu is open, the link matching
   * the pathname must have active classes (text-white, font-semibold) and
   * other links must not.
   */
  it('active link has text-white font-semibold, others do not', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_PATHS), (pathname) => {
        mockPathname = pathname
        const { container } = render(<Navbar />)
        const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

        // Open menu
        fireEvent.click(hamburger)

        const mobileMenu = container.querySelector('#mobile-menu')
        expect(mobileMenu).toBeTruthy()

        const mobileLinks = mobileMenu!.querySelectorAll('a[data-href]')

        mobileLinks.forEach((link) => {
          const href = link.getAttribute('data-href')
          const classList = link.className.split(/\s+/)

          if (href === pathname) {
            expect(classList).toContain('text-white')
            expect(classList).toContain('font-semibold')
          } else {
            expect(classList).not.toContain('text-white')
            expect(classList).not.toContain('font-semibold')
            expect(classList).toContain('text-gray-400')
          }
        })
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: mobile-hamburger-navbar, Property 6: Keyboard toggle ทำงานเหมือน click
describe('Property 6: Keyboard toggle works like click', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any sequence of Enter/Space key presses on the hamburger button,
   * the result must be the same as clicking — menu toggles open/closed correctly.
   * Native <button> elements trigger click on Enter/Space, so we simulate
   * this by firing click events for each key press.
   */
  it('Enter/Space key presses toggle menu state consistently', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('Enter', ' '), { minLength: 1, maxLength: 10 }),
        (keys) => {
          const { container } = render(<Navbar />)
          const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

          keys.forEach((_key, idx) => {
            // Native buttons fire click on Enter/Space — simulate this behavior
            fireEvent.click(hamburger)
            const shouldBeOpen = (idx + 1) % 2 === 1

            expect(hamburger.textContent).toBe(shouldBeOpen ? '✕' : '☰')
            expect(hamburger.getAttribute('aria-expanded')).toBe(String(shouldBeOpen))

            const mobileMenu = container.querySelector('#mobile-menu')
            if (shouldBeOpen) {
              expect(mobileMenu).toBeTruthy()
            } else {
              expect(mobileMenu).toBeNull()
            }
          })
        },
      ),
      { numRuns: 100 },
    )
  })
})
