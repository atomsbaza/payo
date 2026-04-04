import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '@/app/api/webhooks/[address]/route'

// Feature: n8n-webhook, Property 9: Invalid Ethereum address rejection

/**
 * Property 9: Invalid Ethereum address rejection
 *
 * For any string that does not match the Ethereum address format
 * (`/^0x[a-fA-F0-9]{40}$/`), the webhook management API SHALL return HTTP 400.
 *
 * **Validates: Requirements 7.5**
 */

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

// Generator: any string that is NOT a valid Ethereum address
const invalidAddressArb = fc.string().filter(s => !ETH_ADDRESS_RE.test(s))

describe('Feature: n8n-webhook, Property 9: Invalid Ethereum address rejection', () => {
  it('GET returns 400 for any invalid Ethereum address', async () => {
    await fc.assert(
      fc.asyncProperty(invalidAddressArb, async (address) => {
        const req = new NextRequest('https://example.com/api/webhooks/' + address)
        const context = { params: Promise.resolve({ address }) }
        const response = await GET(req, context)
        expect(response.status).toBe(400)
      }),
      { numRuns: 100 },
    )
  })

  it('POST returns 400 for any invalid Ethereum address', async () => {
    await fc.assert(
      fc.asyncProperty(invalidAddressArb, async (address) => {
        const req = new NextRequest('https://example.com/api/webhooks/' + address, {
          method: 'POST',
          body: JSON.stringify({ url: 'https://example.com/webhook' }),
          headers: { 'Content-Type': 'application/json' },
        })
        const context = { params: Promise.resolve({ address }) }
        const response = await POST(req, context)
        expect(response.status).toBe(400)
      }),
      { numRuns: 100 },
    )
  })

  it('DELETE returns 400 for any invalid Ethereum address', async () => {
    await fc.assert(
      fc.asyncProperty(invalidAddressArb, async (address) => {
        const req = new NextRequest('https://example.com/api/webhooks/' + address, {
          method: 'DELETE',
        })
        const context = { params: Promise.resolve({ address }) }
        const response = await DELETE(req, context)
        expect(response.status).toBe(400)
      }),
      { numRuns: 100 },
    )
  })
})
