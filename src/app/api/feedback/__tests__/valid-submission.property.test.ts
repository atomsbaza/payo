import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { CATEGORIES } from '../route'

/**
 * Feature: contact-feedback-page, Property 5: Valid submissions return HTTP 201
 *
 * For any valid (name, email, category, message) tuple, a POST to /api/feedback
 * SHALL return HTTP 201.
 *
 * **Validates: Requirements 4.2**
 */

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: () => true,
  getDb: () => ({
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: () => ({ allowed: true, retryAfter: 0 }),
  }),
}))

// Zod v4 uses a stricter email validator — generate simple local@domain.tld emails
const validEmailArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{0,19}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/),
  fc.stringMatching(/^[a-z]{2,6}$/),
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

function makeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

describe('Feature: contact-feedback-page, Property 5: Valid submissions return HTTP 201', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    const mod = await import('../route')
    POST = mod.POST
  })

  it('returns 201 for any valid (name, email, category, message) tuple', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1),
          email: validEmailArb,
          category: fc.constantFrom(...CATEGORIES),
          message: fc.string({ minLength: 10, maxLength: 2000 }).filter(s => s.trim().length >= 10),
        }),
        async (body) => {
          const res = await POST(makeRequest(body))
          expect(res.status).toBe(201)
          const json = await res.json()
          expect(json.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
