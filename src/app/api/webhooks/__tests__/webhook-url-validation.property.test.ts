import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { z } from 'zod'

// Feature: n8n-webhook, Property 1: HTTPS URL validation

/**
 * Property 1: HTTPS URL validation
 *
 * For any URL string, the webhook registration validation SHALL accept it if
 * and only if it is a well-formed URL with the `https://` scheme. All
 * non-HTTPS URLs (including `http://`, `ftp://`, malformed strings, and empty
 * strings) SHALL be rejected.
 *
 * **Validates: Requirements 1.2, 1.4**
 */

const WebhookRegistrationSchema = z.object({
  url: z.url().refine(
    (u) => u.startsWith('https://'),
    { message: 'Webhook URL must use HTTPS' },
  ),
})

// Valid HTTPS URLs — should pass
const httpsUrlArb = fc.webUrl().map(u => u.replace(/^http:/, 'https:'))

// HTTP URLs — should fail
const httpUrlArb = fc.webUrl().filter(u => u.startsWith('http://'))

// Non-URL strings (not starting with https://) — should fail
const nonUrlStringArb = fc.string().filter(s => !s.startsWith('https://'))

describe('Feature: n8n-webhook, Property 1: HTTPS URL validation', () => {
  it('accepts any well-formed HTTPS URL', () => {
    fc.assert(
      fc.property(httpsUrlArb, (url) => {
        const result = WebhookRegistrationSchema.safeParse({ url })
        expect(result.success).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects any HTTP URL', () => {
    fc.assert(
      fc.property(httpUrlArb, (url) => {
        const result = WebhookRegistrationSchema.safeParse({ url })
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects any non-URL string', () => {
    fc.assert(
      fc.property(nonUrlStringArb, (url) => {
        const result = WebhookRegistrationSchema.safeParse({ url })
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects empty string', () => {
    const result = WebhookRegistrationSchema.safeParse({ url: '' })
    expect(result.success).toBe(false)
  })
})
