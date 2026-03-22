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

// Feature: token-chain-expansion
// Validates: Requirements 8.3, 8.4
describe('Multi-chain validation', () => {
  let POST: typeof import('../route').POST

  beforeEach(async () => {
    const mod = await import('../route')
    POST = mod.POST
  })

  it('returns 400 for unsupported chainId', async () => {
    const res = await POST(makeRequest({
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      token: 'ETH',
      amount: '1',
      memo: '',
      chainId: 999999,
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Unsupported chain')
  })

  it('returns 400 for token not supported on chain (cbBTC on Optimism)', async () => {
    const res = await POST(makeRequest({
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      token: 'cbBTC',
      amount: '1',
      memo: '',
      chainId: 10,
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Token not supported on this chain')
  })

  it('returns 200 for valid multi-chain request (USDC on Base Mainnet)', async () => {
    const res = await POST(makeRequest({
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      token: 'USDC',
      amount: '1',
      memo: '',
      chainId: 8453,
    }))
    expect(res.status).toBe(200)
  })
})

// Feature: tampered-link-blocking, Property 1: API tampered field is the logical inverse of verified
// Validates: Requirements 3.1, 3.2, 3.3
describe('Property 1: API tampered field is the logical inverse of verified', () => {
  it('tampered === !verified for correctly signed, tampered, and unsigned links', async () => {
    // Import modules inside the test to use the mocked rate-limiter
    const { GET } = await import('../[id]/route')
    const { encodePaymentLink } = await import('@/lib/encode')
    const { signPaymentLink } = await import('@/lib/hmac')
    const { NextRequest } = await import('next/server')

    // Arbitrary for valid Ethereum addresses (0x + 40 hex chars)
    const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))
    const arbAddress = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map(
      (chars) => `0x${chars.join('')}`
    )

    // Arbitrary for supported tokens
    const arbToken = fc.constantFrom('ETH', 'USDC')

    // Arbitrary for valid amounts (empty string or positive number as string)
    const arbAmount = fc.oneof(
      fc.constant(''),
      fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
        .filter((n) => n > 0)
        .map((n) => n.toString())
    )

    // Arbitrary for memo (0-200 chars)
    const arbMemo = fc.string({ minLength: 0, maxLength: 200 })

    // Arbitrary for signature strategy: 'valid' | 'tampered' | 'omitted'
    const arbSignatureStrategy = fc.constantFrom('valid', 'tampered', 'omitted')

    await fc.assert(
      fc.asyncProperty(
        arbAddress,
        arbToken,
        arbAmount,
        arbMemo,
        arbSignatureStrategy,
        async (address, token, amount, memo, strategy) => {
          const baseData = {
            address,
            token,
            amount,
            memo,
            chainId: 84532 as const,
          }

          let dataToEncode: typeof baseData & { signature?: string }

          if (strategy === 'valid') {
            // Sign correctly
            const signature = signPaymentLink(baseData)
            dataToEncode = { ...baseData, signature }
          } else if (strategy === 'tampered') {
            // Sign then corrupt the signature
            const signature = signPaymentLink(baseData)
            const corrupted = signature.slice(0, -4) + 'dead'
            dataToEncode = { ...baseData, signature: corrupted }
          } else {
            // Omit signature entirely
            dataToEncode = { ...baseData }
          }

          const id = encodePaymentLink(dataToEncode)
          const req = new NextRequest(`http://localhost:3000/api/links/${id}`)
          const res = await GET(req, { params: Promise.resolve({ id }) })
          const json = await res.json()

          // The core property: tampered is always the logical inverse of verified
          expect(json.tampered).toBe(!json.verified)

          // Additional: valid strategy should yield verified=true, tampered=false
          if (strategy === 'valid') {
            expect(json.verified).toBe(true)
            expect(json.tampered).toBe(false)
          } else {
            // tampered or omitted should yield verified=false, tampered=true
            expect(json.verified).toBe(false)
            expect(json.tampered).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
