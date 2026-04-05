import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: single-use-link, Property 1: Single-use flag round-trip persistence
 *
 * For any valid link creation request with `singleUse` set to either `true`,
 * `false`, or omitted (undefined), the resulting database row's `single_use`
 * column SHALL match the input value. When `singleUse` is omitted, the
 * database row SHALL have `single_use = false`.
 *
 * **Validates: Requirements 1.3, 1.4, 5.1, 5.2**
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

/** Amount: empty string or positive number ≤ 1,000,000 as string */
const amountArb = fc.oneof(
  fc.constant(''),
  fc
    .double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    .filter((n) => n > 0)
    .map((n) => n.toString()),
)

/** singleUse: true, false, or undefined (omitted from request) */
const singleUseArb = fc.constantFrom<boolean | undefined>(true, false, undefined)

// --- Tests ---

describe('Feature: single-use-link, Property 1: Single-use flag round-trip persistence', () => {
  let capturedInsertValues: Record<string, unknown> | null = null

  beforeEach(() => {
    vi.resetModules()
    capturedInsertValues = null
  })

  /**
   * For any valid link creation request, the DB row's singleUse matches
   * the input value (defaulting to false when omitted).
   *
   * **Validates: Requirements 1.3, 1.4, 5.1, 5.2**
   */
  it('DB row single_use matches input singleUse (defaults to false when omitted)', async () => {
    // Mock rate limiter to always allow
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    // Mock DB module to capture insert values
    // The route calls db.insert twice: once for paymentLinks, once for users.
    // We capture the first insert (paymentLinks) by checking for the linkId field.
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        // Only capture the paymentLinks insert (has linkId field)
        if ('linkId' in vals) {
          capturedInsertValues = vals
        }
        return {
          onConflictDoUpdate: vi.fn().mockReturnValue({
            catch: vi.fn(), // for the fire-and-forget users upsert
          }),
        }
      }),
    })

    const mockDb = {
      insert: mockInsert,
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDb,
      db: mockDb,
    }))

    const { POST } = await import('../route')

    await fc.assert(
      fc.asyncProperty(
        ethAddressArb,
        chainTokenArb,
        amountArb,
        singleUseArb,
        async (address, { chainId, token }, amount, singleUse) => {
          capturedInsertValues = null

          const body: Record<string, unknown> = {
            address,
            token,
            amount,
            memo: '',
            chainId,
          }

          // Only include singleUse in the body when it's not undefined
          if (singleUse !== undefined) {
            body.singleUse = singleUse
          }

          const req = new NextRequest('http://localhost:3000/api/links', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })

          const res = await POST(req)
          expect(res.status).toBe(200)

          // Verify the DB insert was called
          expect(capturedInsertValues).not.toBeNull()

          // The expected value: when singleUse is omitted or false, DB should get false
          // When singleUse is true, DB should get true
          const expectedSingleUse = singleUse === true ? true : false

          // Check the captured insert values for the singleUse field
          // The route may pass it as `singleUse` (Drizzle column name mapping)
          const insertedSingleUse = capturedInsertValues!.singleUse ?? false
          expect(insertedSingleUse).toBe(expectedSingleUse)
        },
      ),
      { numRuns: 100 },
    )
  })
})
