// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { render } from '@testing-library/react'
import { translations, Lang } from '@/lib/i18n'

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button">ConnectButton</div>,
}))

// Mock useIsCompanyWallet hook (uses wagmi's useAccount internally)
vi.mock('@/hooks/useIsCompanyWallet', () => ({
  useIsCompanyWallet: () => ({ isCompany: false, isConnected: false }),
}))

let mockLang: Lang = 'th'
vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: mockLang,
    t: translations[mockLang],
    toggleLang: () => {},
  }),
}))

import LandingPage from '../page'

const LANDING_TEXT_KEYS = [
  'heroTitle',
  'heroSubtitle',
  'heroCta',
  'howItWorksTitle',
  'step1Title',
  'step1Desc',
  'step2Title',
  'step2Desc',
  'step3Title',
  'step3Desc',
  'valuePropsTitle',
  'valueProp1',
  'valueProp2',
  'valueProp3',
] as const

describe('Landing Page — Property 6: Landing page i18n renders correct language', () => {
  /**
   * **Validates: Requirements 4.7**
   *
   * Property 6: For any language setting (th or en), the Landing Page should
   * render text content that matches the corresponding translation keys from
   * the i18n dictionary.
   */
  it('renders all i18n text matching the selected language', () => {
    const langArb = fc.constantFrom<Lang>('th', 'en')

    fc.assert(
      fc.property(langArb, (lang) => {
        mockLang = lang
        const t = translations[lang]

        const { container } = render(<LandingPage />)
        const text = container.textContent ?? ''

        for (const key of LANDING_TEXT_KEYS) {
          const expected = t[key] as string
          expect(text).toContain(expected)
        }
      }),
      { numRuns: 100 },
    )
  })
})
