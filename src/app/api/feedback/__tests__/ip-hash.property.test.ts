import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { CATEGORIES } from '../route'

/**
 * Feature: contact-feedback-page, Property 9: Stored ip_hash is always SHA-256 of the client IP
 *
 * For any IP string used in a submission, the ip_hash value persisted to the
 * feedback table SHALL equal SHA-256(ip) encoded as a lowercase hex string.
 *
 * **Validates: Requirements 6.3**
 */

async function sha256Hex(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Capture the ipHash passed to db.insert().values()
let capturedIpHash: string | null = null

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: () => true,
  getDb: () => ({
    insert: () => ({
      values: (row: { ipHash: string }) => {
        capturedIpHash = row.ipHash
        return Promise.resolve()
      },
    }),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: () => ({ allowed: true, retryAfter: 0 }),
  }),
}))

function makeRequest(ip: string, body: unknown): NextRequest {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
  }) as unknown as NextRequest
}

const validBody = {
  name: 'Test User',
  email: 'test@example.com',
  category: CATEGORIES[0],
  message: 'This is a valid message with enough chars.',
}

describe('Feature: contact-feedback-page, Property 9: Stored ip_hash is always SHA-256 of the client IP', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    capturedIpHash = null
    const mod = await import('../route')
    POST = mod.POST
  })

  it('stores SHA-256 hex of the client IP for any IP string', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Exclude commas so extractIp returns the full string (trimmed)
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(',') && s.trim().length > 0),
        async (ip) => {
          capturedIpHash = null
          const res = await POST(makeRequest(ip, validBody))
          expect(res.status).toBe(201)

          // extractIp trims the x-forwarded-for value
          const expectedHash = await sha256Hex(ip.trim())
          expect(capturedIpHash).toBe(expectedHash)
        },
      ),
      { numRuns: 100 },
    )
  })
})
