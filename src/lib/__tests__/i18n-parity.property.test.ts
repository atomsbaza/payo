import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { translations } from '../i18n'

/**
 * Feature: payo-rebrand, Property 5: i18n keys ครบทั้งสองภาษา
 *
 * For any translation key that exists in Thai, the same key must exist in English,
 * and vice versa (key parity between both languages).
 *
 * Validates: Requirements 1.1, 1.2, 3.1, 3.2
 */

const thKeys = Object.keys(translations.th)
const enKeys = Object.keys(translations.en)

describe('Feature: payo-rebrand, Property 5: i18n keys ครบทั้งสองภาษา', () => {
  it('every Thai key exists in English translations', () => {
    fc.assert(
      fc.property(fc.constantFrom(...thKeys), (key) => {
        expect(enKeys).toContain(key)
      }),
      { numRuns: Math.max(100, thKeys.length * 2) },
    )
  })

  it('every English key exists in Thai translations', () => {
    fc.assert(
      fc.property(fc.constantFrom(...enKeys), (key) => {
        expect(thKeys).toContain(key)
      }),
      { numRuns: Math.max(100, enKeys.length * 2) },
    )
  })
})
