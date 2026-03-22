import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { translations } from '../i18n'

/**
 * Feature: ux-improvements, Property 4: i18n keys ครบทุกภาษา
 *
 * For every language in translations, verify all new ux-improvements keys
 * are non-empty strings.
 *
 * Validates: Requirements 2.7, 3.4, 4.6, 5.5, 7.6, 8.7
 */

const UX_IMPROVEMENT_KEYS = [
  'showFeeBreakdown',
  'hideFeeBreakdown',
  'openInWallet',
  'confirmedAt',
  'shareQR',
  'waitingForConfirmation',
  'confirmationProgress',
  'pollTimeout',
  'checkOnExplorer',
  'addressValid',
  'addressInvalid',
  'addressChecksumWarning',
] as const

const LANGUAGES = Object.keys(translations) as Array<keyof typeof translations>

describe('Feature: ux-improvements, Property 4: i18n keys ครบทุกภาษา', () => {
  it('every new ux-improvements key exists and is a non-empty string for every language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANGUAGES),
        fc.constantFrom(...UX_IMPROVEMENT_KEYS),
        (lang, key) => {
          const t = translations[lang] as Record<string, unknown>
          const value = t[key]
          expect(typeof value).toBe('string')
          expect((value as string).length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
