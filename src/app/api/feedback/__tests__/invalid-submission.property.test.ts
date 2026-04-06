import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { CATEGORIES } from '../route'

/**
 * Feature: contact-feedback-page, Property 6: Invalid submissions return HTTP 400 with errors array
 *
 * For any request body that violates at least one FeedbackSubmissionSchema rule,
 * a POST to /api/feedback SHALL return HTTP 400 with a JSON body containing an errors array.
 *
 * **Validates: Requirements 4.3**
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

function makeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

const validBase = {
  name: 'Test User',
  email: 'test@example.com',
  category: 'General Feedback' as const,
  message: 'This is a valid message with enough chars.',
}

// Arbitrary for invalid bodies — each violates at least one rule
const invalidBodyArb = fc.oneof(
  // Empty name (trimmed length 0)
  fc.constant({ ...validBase, name: '' }),
  // Whitespace-only name
  fc.constant({ ...validBase, name: '   ' }),
  // Name too long (>100 trimmed chars)
  fc.string({ minLength: 101, maxLength: 150 }).filter(s => s.trim().length > 100).map(name => ({ ...validBase, name })),
  // Invalid email (no @)
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('@')).map(email => ({ ...validBase, email })),
  // Bad category
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => !(CATEGORIES as readonly string[]).includes(s)).map(category => ({ ...validBase, category })),
  // Message too short (<10 trimmed chars)
  fc.string({ minLength: 0, maxLength: 9 }).filter(s => s.trim().length < 10).map(message => ({ ...validBase, message })),
  // Message too long (>2000 trimmed chars)
  fc.string({ minLength: 2001, maxLength: 2100 }).filter(s => s.trim().length > 2000).map(message => ({ ...validBase, message })),
  // Missing fields entirely
  fc.constant({}),
  fc.constant({ name: 'Test' }),
)

describe('Feature: contact-feedback-page, Property 6: Invalid submissions return HTTP 400 with errors array', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    const mod = await import('../route')
    POST = mod.POST
  })

  it('returns 400 with errors array for any body violating schema rules', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidBodyArb,
        async (body) => {
          const res = await POST(makeRequest(body))
          expect(res.status).toBe(400)
          const json = await res.json()
          expect(Array.isArray(json.errors)).toBe(true)
          expect(json.errors.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
