import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Unit tests for API route edge cases
 *
 * - Returns 503 when isDatabaseConfigured() returns false (Req 4.5)
 * - Returns 500 when DB insert throws (Req 4.4)
 */

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: () => ({ allowed: true, retryAfter: 0 }),
  }),
}))

const mockIsDatabaseConfigured = vi.fn()
const mockInsertValues = vi.fn()

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: () => mockIsDatabaseConfigured(),
  getDb: () => ({
    insert: () => ({
      values: mockInsertValues,
    }),
  }),
}))

const validBody = {
  name: 'Test User',
  email: 'test@example.com',
  category: 'General Feedback',
  message: 'This is a valid message with enough chars.',
}

function makeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest
}

describe('POST /api/feedback — edge cases', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../route')
    POST = mod.POST
  })

  it('returns 503 when isDatabaseConfigured() returns false', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toBe('Service unavailable')
  })

  it('returns 500 when DB insert throws', async () => {
    mockIsDatabaseConfigured.mockReturnValue(true)
    mockInsertValues.mockRejectedValue(new Error('DB connection failed'))

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to submit feedback')
  })

  it('returns 400 for invalid JSON body', async () => {
    mockIsDatabaseConfigured.mockReturnValue(true)

    const req = new Request('http://localhost/api/feedback', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    // Override rate-limit mock for this test only
    const { createRateLimiter } = await import('@/lib/rate-limit')
    vi.mocked(createRateLimiter)

    // Use a fresh module with a custom rate-limit mock
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: false, retryAfter: 3600 }),
      }),
    }))

    // Re-import to pick up the new mock
    vi.resetModules()
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: false, retryAfter: 3600 }),
      }),
    }))
    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => ({ insert: () => ({ values: () => Promise.resolve() }) }),
    }))

    const { POST: freshPOST } = await import('../route')
    const res = await freshPOST(makeRequest(validBody))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('Too many requests')
    expect(typeof json.retryAfter).toBe('number')
  })
})
