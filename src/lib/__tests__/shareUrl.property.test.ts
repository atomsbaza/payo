// Feature: social-share-buttons, Property 1: LINE/WhatsApp URL encoding round-trip
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { buildLineShareUrl, buildWhatsAppShareUrl, buildTelegramShareUrl, buildShareMessage } from '../shareUrl'

/**
 * **Validates: Requirements 2.1, 2.2, 3.1, 3.2**
 *
 * For any arbitrary message string, buildLineShareUrl and buildWhatsAppShareUrl
 * should produce URLs where decoding the `text` query parameter yields the
 * original message (round-trip encoding property).
 */
describe('Property 1: LINE/WhatsApp URL encoding round-trip', () => {
  it('buildLineShareUrl: decoding the text param yields the original message', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const result = buildLineShareUrl(message)
        const url = new URL(result)
        const decoded = url.searchParams.get('text')
        expect(decoded).toBe(message)
      }),
      { numRuns: 100 }
    )
  })

  it('buildWhatsAppShareUrl: decoding the text param yields the original message', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const result = buildWhatsAppShareUrl(message)
        const url = new URL(result)
        const decoded = url.searchParams.get('text')
        expect(decoded).toBe(message)
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: social-share-buttons, Property 2: Telegram URL encoding round-trip

/**
 * **Validates: Requirements 4.1, 4.2**
 *
 * For any arbitrary url and text strings, buildTelegramShareUrl(url, text)
 * should produce a URL where decoding the `url` and `text` query parameters
 * yields the original values (round-trip encoding property).
 */
describe('Property 2: Telegram URL encoding round-trip', () => {
  it('decoding the url param yields the original url', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (url, text) => {
        const result = buildTelegramShareUrl(url, text)
        const parsed = new URL(result)
        expect(parsed.searchParams.get('url')).toBe(url)
      }),
      { numRuns: 100 }
    )
  })

  it('decoding the text param yields the original text', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (url, text) => {
        const result = buildTelegramShareUrl(url, text)
        const parsed = new URL(result)
        expect(parsed.searchParams.get('text')).toBe(text)
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: social-share-buttons, Property 3: Share message contains payment URL

/**
 * **Validates: Requirements 2.3, 3.3**
 *
 * For any arbitrary URL string, buildShareMessage(translations, url)
 * should produce a string that contains the original URL as a substring.
 */
describe('Property 3: Share message contains payment URL', () => {
  it('buildShareMessage result contains the original URL', () => {
    const mockT = { shareMessage: (url: string) => `Pay via Payo: ${url}` }

    fc.assert(
      fc.property(fc.string(), (url) => {
        const result = buildShareMessage(mockT, url)
        expect(result).toContain(url)
      }),
      { numRuns: 100 }
    )
  })
})
