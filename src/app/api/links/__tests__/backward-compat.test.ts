import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { encodePaymentLink, type PaymentLinkData } from '@/lib/encode'
import { signPaymentLink } from '@/lib/hmac'

/**
 * Task 12.3: Backward compatibility unit test
 *
 * Verifies that legacy HMAC-based payment links (created before the database
 * was introduced) still work correctly through the actual GET /api/links/[id]
 * route handler when no database is configured.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */

// Mock DB as not configured — forces the HMAC fallback path
vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: () => false,
  getDb: () => {
    throw new Error('DB not configured')
  },
  db: new Proxy(
    {},
    {
      get() {
        throw new Error('DB not configured')
      },
    },
  ),
}))

// Mock link-events so fire-and-forget logging doesn't hit the DB
vi.mock('@/lib/link-events', () => ({
  logLinkEvent: vi.fn().mockResolvedValue(undefined),
}))

describe('Task 12.3: Backward compatibility — legacy HMAC-based links via GET handler', () => {
  let GET: typeof import('../[id]/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../[id]/route')
    GET = mod.GET
  })

  it('decodes a legacy HMAC-signed link and returns verified: true with correct data', async () => {
    // 1. Create a payment link the "old way" — encode + HMAC sign
    const original = {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      token: 'ETH',
      amount: '0.5',
      memo: 'Legacy test payment',
      chainId: 84532,
    }
    const signature = signPaymentLink(original)
    const signedData: PaymentLinkData = { ...original, signature }
    const linkId = encodePaymentLink(signedData)

    // 2. Call GET /api/links/[encoded_id]
    const req = new NextRequest(`http://localhost:3000/api/links/${linkId}`)
    const res = await GET(req, { params: Promise.resolve({ id: linkId }) })

    // 3. Verify HTTP 200
    expect(res.status).toBe(200)

    const json = await res.json()

    // 4. Verify response format: { id, data, verified, tampered }
    expect(json).toHaveProperty('id')
    expect(json).toHaveProperty('data')
    expect(json).toHaveProperty('verified')
    expect(json).toHaveProperty('tampered')

    // 5. Verify the data is correct
    expect(json.id).toBe(linkId)
    expect(json.verified).toBe(true)
    expect(json.tampered).toBe(false)
    expect(json.data.address).toBe(original.address)
    expect(json.data.token).toBe(original.token)
    expect(json.data.amount).toBe(original.amount)
    expect(json.data.memo).toBe(original.memo)
    expect(json.data.chainId).toBe(original.chainId)
    expect(json.data.signature).toBe(signature)
  })

  it('detects a tampered legacy link and returns verified: false, tampered: true', async () => {
    const original = {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      token: 'USDC',
      amount: '100',
      memo: 'Tampered test',
      chainId: 84532,
    }
    const signature = signPaymentLink(original)

    // Tamper: change the address but keep the original signature
    const tampered: PaymentLinkData = {
      ...original,
      address: '0x1111111111111111111111111111111111111111',
      signature,
    }
    const linkId = encodePaymentLink(tampered)

    const req = new NextRequest(`http://localhost:3000/api/links/${linkId}`)
    const res = await GET(req, { params: Promise.resolve({ id: linkId }) })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json).toHaveProperty('id')
    expect(json).toHaveProperty('data')
    expect(json).toHaveProperty('verified')
    expect(json).toHaveProperty('tampered')

    expect(json.verified).toBe(false)
    expect(json.tampered).toBe(true)
  })

  it('returns 404 for an invalid (non-decodable) link ID', async () => {
    const invalidId = 'not-a-valid-base64-payload'

    const req = new NextRequest(`http://localhost:3000/api/links/${invalidId}`)
    const res = await GET(req, { params: Promise.resolve({ id: invalidId }) })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('legacy link with empty amount and memo still works', async () => {
    const original = {
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      token: 'ETH',
      amount: '',
      memo: '',
      chainId: 8453,
    }
    const signature = signPaymentLink(original)
    const signedData: PaymentLinkData = { ...original, signature }
    const linkId = encodePaymentLink(signedData)

    const req = new NextRequest(`http://localhost:3000/api/links/${linkId}`)
    const res = await GET(req, { params: Promise.resolve({ id: linkId }) })

    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.verified).toBe(true)
    expect(json.tampered).toBe(false)
    expect(json.data.address).toBe(original.address)
    expect(json.data.amount).toBe('')
    expect(json.data.memo).toBe('')
  })
})
