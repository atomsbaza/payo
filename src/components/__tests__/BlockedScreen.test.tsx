// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup } from '@testing-library/react'
import { translations, Lang } from '@/lib/i18n'

/**
 * Feature: tampered-link-blocking
 * Property 3: BlockedScreen renders correct i18n text
 *
 * **Validates: Requirements 1.2, 4.1, 4.2, 4.3**
 */

// Track the current language for the mock
let mockLang: Lang = 'th'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: mockLang,
    t: translations[mockLang],
    toggleLang: () => {},
  }),
}))

import { BlockedScreen } from '../BlockedScreen'

// --- Generators ---

const langArb = fc.constantFrom<Lang>('th', 'en')

describe('BlockedScreen — Property 3: BlockedScreen renders correct i18n text', () => {
  /**
   * **Validates: Requirements 1.2, 4.1, 4.2, 4.3**
   *
   * Property 3: For any language setting (th or en), the BlockedScreen
   * component SHALL render text that matches the corresponding
   * tamperedTitle and tamperedDesc translation keys from the i18n
   * dictionary for that language.
   */
  it('rendered output contains tamperedTitle and tamperedDesc for the selected language', () => {
    fc.assert(
      fc.property(langArb, (lang) => {
        mockLang = lang
        cleanup()

        const { container } = render(<BlockedScreen />)
        const text = container.textContent ?? ''

        const expectedTitle = translations[lang].tamperedTitle
        const expectedDesc = translations[lang].tamperedDesc

        expect(text).toContain(expectedTitle)
        expect(text).toContain(expectedDesc)
      }),
      { numRuns: 100 }
    )
  })
})
