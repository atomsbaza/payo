import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { translations, type Lang } from '../i18n'

// Task 1.2 - Property 6: Gas tooltip รองรับทุกภาษาใน i18n
// Feature: ux-polish, Property 6: Gas tooltip รองรับทุกภาษาใน i18n
// **Validates: Requirements 5.3**
describe('Property 6: Gas tooltip รองรับทุกภาษาใน i18n', () => {
  const langs = Object.keys(translations) as Lang[]

  it('gasForErc20, copyAddress, and viewOnExplorer are non-empty strings for every language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...langs),
        (lang) => {
          const t = translations[lang]

          expect(typeof t.gasForErc20).toBe('string')
          expect(t.gasForErc20.length).toBeGreaterThan(0)

          expect(typeof t.copyAddress).toBe('string')
          expect(t.copyAddress.length).toBeGreaterThan(0)

          expect(typeof t.viewOnExplorer).toBe('string')
          expect(t.viewOnExplorer.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
