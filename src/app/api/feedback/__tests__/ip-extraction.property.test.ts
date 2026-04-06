import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { extractIp } from '../route'

/**
 * Feature: contact-feedback-page, Property 8: IP extraction follows header priority
 *
 * For any combination of x-forwarded-for and x-real-ip header values,
 * the extracted IP SHALL be:
 *   - the first value from x-forwarded-for if present
 *   - otherwise the value of x-real-ip
 *   - otherwise the string "unknown"
 *
 * **Validates: Requirements 5.3**
 */

function makeRequestWithHeaders(headers: Record<string, string>): NextRequest {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers,
  }) as unknown as NextRequest
}

describe('Feature: contact-feedback-page, Property 8: IP extraction follows header priority', () => {
  it('uses first value from x-forwarded-for when present', () => {
    fc.assert(
      fc.property(
        // Exclude commas so the first segment is unambiguous
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(',') && s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(',')),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        (firstIp, secondIp, realIp) => {
          const forwarded = `${firstIp}, ${secondIp}`
          const headers: Record<string, string> = { 'x-forwarded-for': forwarded }
          if (realIp !== undefined) headers['x-real-ip'] = realIp

          const req = makeRequestWithHeaders(headers)
          const extracted = extractIp(req)
          expect(extracted).toBe(firstIp.trim())
        },
      ),
      { numRuns: 100 },
    )
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    fc.assert(
      fc.property(
        // Whitespace-only values get trimmed to "" by the route, which is falsy-ish
        // but the route returns realIp.trim() — filter to non-empty-after-trim values
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (realIp) => {
          const req = makeRequestWithHeaders({ 'x-real-ip': realIp })
          const extracted = extractIp(req)
          expect(extracted).toBe(realIp.trim())
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns "unknown" when neither header is present', () => {
    const req = makeRequestWithHeaders({})
    expect(extractIp(req)).toBe('unknown')
  })
})
