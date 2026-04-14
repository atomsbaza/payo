import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  encodeTransferLink,
  decodeTransferLink,
  type TransferLinkData,
} from '@/lib/encode'
import { signTransferLink, verifyTransferLink } from '@/lib/hmac'

/**
 * Feature: database-integration, Property 15: API response format preservation
 *
 * For any valid payment link creation or retrieval request, the API response
 * JSON shape should contain the same top-level keys as the current implementation:
 * - Creation: { id (string), url (string), data (object with address, token, amount, memo, chainId, signature) }
 * - Retrieval: { id (string), data (object), verified (boolean), tampered (boolean) }
 *
 * This ensures that frontend clients do not break regardless of whether the
 * database is used or not.
 *
 * **Validates: Requirements 8.1, 8.3**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid chain + token pairs from the registry */
const chainTokenArb = fc.constantFrom(
  { chainId: 84532, token: 'ETH' },
  { chainId: 84532, token: 'USDC' },
  { chainId: 8453, token: 'ETH' },
  { chainId: 8453, token: 'USDC' },
  { chainId: 8453, token: 'DAI' },
  { chainId: 10, token: 'ETH' },
  { chainId: 10, token: 'USDC' },
  { chainId: 42161, token: 'ETH' },
  { chainId: 42161, token: 'USDC' },
)

/** Amount: empty string or positive number as string */
const amountArb = fc.oneof(
  fc.constant(''),
  fc
    .double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    .filter((n) => n > 0)
    .map((n) => n.toString()),
)

/** Memo: 0-200 grapheme-safe characters */
const memoArb = fc.string({ minLength: 0, maxLength: 200, unit: 'grapheme' })

// --- Simulated response builders (mirror actual API route logic) ---

/**
 * Simulates the creation response from POST /api/links.
 * The route signs the data, encodes it, and returns { id, url, data }.
 */
function simulateCreationResponse(input: {
  address: string
  token: string
  amount: string
  memo: string
  chainId: number
}): Record<string, unknown> {
  const data: TransferLinkData = { ...input }
  const signature = signTransferLink(data)
  const signedData: TransferLinkData = { ...data, signature }
  const id = encodeTransferLink(signedData)
  const url = `https://example.com/pay/${id}`
  return { id, url, data: signedData }
}

/**
 * Simulates the retrieval response from GET /api/links/[id].
 * Decodes the link ID, verifies HMAC, returns { id, data, verified, tampered }.
 */
function simulateRetrievalResponse(linkId: string): Record<string, unknown> {
  const data = decodeTransferLink(linkId)
  if (!data) {
    return { error: 'Invalid or expired link' }
  }
  const hmacValid = verifyTransferLink(data)
  return { id: linkId, data, verified: hmacValid, tampered: !hmacValid }
}

// --- Tests ---

describe('Feature: database-integration, Property 15: API response format preservation', () => {
  /**
   * Creation response shape: { id (string), url (string), data (object) }
   * where data contains address, token, amount, memo, chainId, signature.
   * **Validates: Requirements 8.1, 8.3**
   */
  it('creation response has correct shape with id, url, and data object', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        (address, { chainId, token }, amount, memo) => {
          const response = simulateCreationResponse({
            address,
            token,
            amount,
            memo,
            chainId,
          })

          // Top-level keys
          expect(response).toHaveProperty('id')
          expect(response).toHaveProperty('url')
          expect(response).toHaveProperty('data')

          // Type checks for top-level keys
          expect(typeof response.id).toBe('string')
          expect(typeof response.url).toBe('string')
          expect(typeof response.data).toBe('object')
          expect(response.data).not.toBeNull()

          // id must be non-empty
          expect((response.id as string).length).toBeGreaterThan(0)

          // url must contain the id
          expect(response.url as string).toContain(response.id as string)

          // data object must contain the required payment link fields
          const data = response.data as Record<string, unknown>
          expect(data).toHaveProperty('address')
          expect(data).toHaveProperty('token')
          expect(data).toHaveProperty('amount')
          expect(data).toHaveProperty('memo')
          expect(data).toHaveProperty('chainId')
          expect(data).toHaveProperty('signature')

          // data field types
          expect(typeof data.address).toBe('string')
          expect(typeof data.token).toBe('string')
          expect(typeof data.amount).toBe('string')
          expect(typeof data.memo).toBe('string')
          expect(typeof data.chainId).toBe('number')
          expect(typeof data.signature).toBe('string')
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Retrieval response shape: { id (string), data (object), verified (boolean), tampered (boolean) }
   * **Validates: Requirements 8.1, 8.3**
   */
  it('retrieval response has correct shape with id, data, verified, and tampered', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        (address, { chainId, token }, amount, memo) => {
          // Create a valid signed link first
          const data: TransferLinkData = { address, token, amount, memo, chainId }
          const signature = signTransferLink(data)
          const signedData: TransferLinkData = { ...data, signature }
          const linkId = encodeTransferLink(signedData)

          // Simulate retrieval
          const response = simulateRetrievalResponse(linkId)

          // Top-level keys
          expect(response).toHaveProperty('id')
          expect(response).toHaveProperty('data')
          expect(response).toHaveProperty('verified')
          expect(response).toHaveProperty('tampered')

          // Type checks
          expect(typeof response.id).toBe('string')
          expect(typeof response.data).toBe('object')
          expect(response.data).not.toBeNull()
          expect(typeof response.verified).toBe('boolean')
          expect(typeof response.tampered).toBe('boolean')

          // For a valid signed link, verified should be true and tampered false
          expect(response.verified).toBe(true)
          expect(response.tampered).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Retrieval response for tampered links still preserves the same shape,
   * but with verified=false and tampered=true.
   * **Validates: Requirements 8.1, 8.3**
   */
  it('tampered link retrieval preserves response shape with verified=false, tampered=true', () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        memoArb,
        ethAddressArb,
        (address, { chainId, token }, amount, memo, differentAddress) => {
          fc.pre(differentAddress !== address)

          // Sign with original address, then tamper
          const data: TransferLinkData = { address, token, amount, memo, chainId }
          const signature = signTransferLink(data)
          const tamperedData: TransferLinkData = {
            ...data,
            address: differentAddress,
            signature,
          }
          const linkId = encodeTransferLink(tamperedData)

          // Simulate retrieval of tampered link
          const response = simulateRetrievalResponse(linkId)

          // Shape must be identical to valid link response
          expect(response).toHaveProperty('id')
          expect(response).toHaveProperty('data')
          expect(response).toHaveProperty('verified')
          expect(response).toHaveProperty('tampered')

          // Types must be correct
          expect(typeof response.id).toBe('string')
          expect(typeof response.data).toBe('object')
          expect(response.data).not.toBeNull()
          expect(typeof response.verified).toBe('boolean')
          expect(typeof response.tampered).toBe('boolean')

          // Tampered link should be detected
          expect(response.verified).toBe(false)
          expect(response.tampered).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
