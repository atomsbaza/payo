import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { translations } from '../i18n'

/**
 * Feature: payo-rebrand, Property 1: ชื่อแบรนด์เดิมถูกแทนที่ทั้งหมด
 *
 * For any translation key in both languages (th, en),
 * the value must NOT contain "Crypto Pay Link".
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4
 */

const LANGUAGES = Object.keys(translations) as Array<keyof typeof translations>

function getStringValues(lang: keyof typeof translations): Array<{ key: string; value: string }> {
  const t = translations[lang] as Record<string, unknown>
  const entries: Array<{ key: string; value: string }> = []
  for (const [key, val] of Object.entries(t)) {
    if (typeof val === 'string') {
      entries.push({ key, value: val })
    } else if (typeof val === 'function') {
      // Call function-type values with sample args to check their output
      try {
        const result = (val as (...args: unknown[]) => string)('test', 'test', 'test')
        if (typeof result === 'string') {
          entries.push({ key, value: result })
        }
      } catch {
        // skip if function signature doesn't match
      }
    }
  }
  return entries
}

describe('Feature: payo-rebrand, Property 1: ชื่อแบรนด์เดิมถูกแทนที่ทั้งหมด', () => {
  it('no translation value contains "Crypto Pay Link" in any language', () => {
    const allEntries = LANGUAGES.flatMap((lang) =>
      getStringValues(lang).map((entry) => ({ lang, ...entry })),
    )

    fc.assert(
      fc.property(fc.constantFrom(...allEntries), ({ lang, key, value }) => {
        expect(value.toLowerCase()).not.toContain('crypto pay link')
      }),
      { numRuns: Math.max(100, allEntries.length * 2) },
    )
  })
})
