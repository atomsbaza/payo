import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

// Feature: security-hardening, Property 9: API ปฏิเสธ invalid input ด้วย status 400
// Validates: Requirements 7.1, 7.2, 7.3

// Mock rate limiter so property tests don't hit the 20 req/60s limit
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: () => ({ allowed: true, retryAfter: 0 }),
  }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBase = {
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  token: 'ETH' as const,
  amount: '1',
  memo: '',
  chainId: 84532,
}

describe('Property 9: API rejects invalid input with 400', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    // Re-import to pick up the mock
    const mod = await import('../route')
    POST = mod.POST
  })

  it('rejects invalid Ethereum addresses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !/^0x[a-fA-F0-9]{40}$/.test(s)
        ),
        async (badAddress) => {
          const res = await POST(makeRequest({ ...validBase, address: badAddress }))
          expect(res.status).toBe(400)
          const json = await res.json()
          expect(json.error).toBeTruthy()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects unsupported tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => s !== 'ETH' && s !== 'USDC'
        ),
        async (badToken) => {
          const res = await POST(makeRequest({ ...validBase, token: badToken }))
          expect(res.status).toBe(400)
          const json = await res.json()
          expect(json.error).toBeTruthy()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects invalid amounts (non-empty, non-positive)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Negative doubles (excluding -0 which Number() treats as 0)
          fc.double({ min: -1e15, max: -Number.MIN_VALUE, noNaN: true }).map(String),
          fc.constantFrom('abc', '-1', '0', 'NaN', '-Infinity', 'not-a-number')
        ),
        async (badAmount) => {
          const res = await POST(makeRequest({ ...validBase, amount: badAmount }))
          expect(res.status).toBe(400)
          const json = await res.json()
          expect(json.error).toBeTruthy()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: security-hardening, Property 10: Memo ที่ยาวเกิน 200 ตัวอักษรถูกตัดให้เหลือ 200
// Validates: Requirements 7.4
describe('Property 10: Long memo is truncated to 200 chars', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    const mod = await import('../route')
    POST = mod.POST
  })

  it('truncates memo longer than 200 characters to exactly 200 and preserves prefix', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 201, maxLength: 500 }),
        async (longMemo) => {
          const res = await POST(makeRequest({ ...validBase, memo: longMemo }))
          expect(res.status).toBe(200)
          const json = await res.json()
          const returnedMemo: string = json.data.memo
          expect(returnedMemo.length).toBe(200)
          expect(longMemo.startsWith(returnedMemo)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
