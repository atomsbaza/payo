// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

// --- Mocks ---
let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button">ConnectButton</div>,
}))

vi.mock('@/hooks/useIsCompanyWallet', () => ({
  useIsCompanyWallet: () => ({ isCompany: false, isConnected: true }),
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

import { Navbar } from '../Navbar'

beforeEach(() => {
  mockPathname = '/'
})

afterEach(() => {
  cleanup()
})

// 5.1 ConnectButton อยู่นอก mobile menu container
describe('5.1 ConnectButton is outside mobile menu container', () => {
  /**
   * Validates: Requirement 1.4
   */
  it('ConnectButton is rendered in the document but NOT inside #mobile-menu', () => {
    const { container } = render(<Navbar />)
    const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

    // Open menu
    fireEvent.click(hamburger)

    const mobileMenu = container.querySelector('#mobile-menu')
    expect(mobileMenu).toBeTruthy()

    const connectButton = container.querySelector('[data-testid="connect-button"]')
    expect(connectButton).toBeTruthy()

    // ConnectButton must NOT be inside #mobile-menu
    expect(mobileMenu!.contains(connectButton)).toBe(false)
  })
})


// 5.2 Viewport change auto-close
describe('5.2 Viewport change auto-closes mobile menu', () => {
  /**
   * Validates: Requirements 4.1, 4.2
   */
  it('menu closes when matchMedia fires change with matches: true', () => {
    let matchMediaChangeHandler: ((e: MediaQueryListEvent) => void) | null = null
    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') matchMediaChangeHandler = handler
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })

    const { container } = render(<Navbar />)
    const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

    // Open menu
    fireEvent.click(hamburger)
    expect(hamburger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('#mobile-menu')).toBeTruthy()

    // Simulate viewport change to desktop
    act(() => {
      matchMediaChangeHandler?.({ matches: true } as MediaQueryListEvent)
    })

    // Menu should be closed
    expect(hamburger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('#mobile-menu')).toBeNull()
  })
})

// 5.3 Escape key ปิด menu และ return focus
describe('5.3 Escape key closes menu and returns focus to hamburger', () => {
  /**
   * Validates: Requirement 5.3
   */
  it('pressing Escape closes the menu and focuses the hamburger button', () => {
    const { container } = render(<Navbar />)
    const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

    // Open menu
    fireEvent.click(hamburger)
    expect(hamburger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('#mobile-menu')).toBeTruthy()

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    // Menu should be closed
    expect(hamburger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('#mobile-menu')).toBeNull()

    // Focus should be on the hamburger button
    expect(document.activeElement).toBe(hamburger)
  })
})

// 5.4 Mobile menu มี role="navigation" และ aria-label
describe('5.4 Mobile menu has role="navigation" and aria-label', () => {
  /**
   * Validates: Requirement 5.4
   */
  it('mobile menu container has correct ARIA attributes', () => {
    const { container } = render(<Navbar />)
    const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

    // Open menu
    fireEvent.click(hamburger)

    const mobileMenu = container.querySelector('#mobile-menu')
    expect(mobileMenu).toBeTruthy()
    expect(mobileMenu!.getAttribute('role')).toBe('navigation')
    expect(mobileMenu!.getAttribute('aria-label')).toBe('Main navigation')
  })
})

// 5.5 Focus management เมื่อเปิด/ปิด menu
describe('5.5 Focus management when opening/closing menu', () => {
  /**
   * Validates: Requirement 5.5
   */
  it('opening menu focuses first link, Escape-to-close focuses hamburger', () => {
    const { container } = render(<Navbar />)
    const hamburger = container.querySelector('button[aria-controls="mobile-menu"]') as HTMLButtonElement

    // Open menu
    fireEvent.click(hamburger)

    // Focus should be on the first link inside mobile menu
    const mobileMenu = container.querySelector('#mobile-menu')
    expect(mobileMenu).toBeTruthy()
    const firstLink = mobileMenu!.querySelector('a[data-href]') as HTMLAnchorElement
    expect(firstLink).toBeTruthy()
    expect(document.activeElement).toBe(firstLink)

    // Close menu via Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    // Focus should return to hamburger button
    expect(document.activeElement).toBe(hamburger)
  })
})
