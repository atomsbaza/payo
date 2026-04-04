import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: single-use-link, Property 4: Idempotent duplicate confirmation
 *
 * For any payment confirmation sent twice with the same `txHash` for the same
 * link, the second call SHALL return `{ success: true, duplicate: true }` and
 * the link's `is_active` and `pay_count` SHALL remain unchanged from after the
 * first confirmation.
 *
 * **Validates: Requirements 2.4**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid tx hash: 0x + 64 hex chars */
const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid chain + token pairs */
const chainTokenArb = fc.constantFrom(
  { chainId: 84532, token: 'ETH' },
  { chainId: 84532, token: 'USDC' },
  { chainId: 8453, token: 'ETH' },
  { chainId: 8453, token: 'USDC' },
)

/** Amount: positive number as string */
const amountArb = fc
  .double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true })
  .filter((n) => n > 0)
  .map((n) => n.toString())

/** Random link ID (alphanumeric) */
const linkIdArb = fc
  .string({ minLength: 8, maxLength: 32, unit: 'grapheme' })
  .filter((s) => /^[a-zA-Z0-9]+$/.test(s))

/** singleUse flag — test both true and false */
const singleUseArb = fc.boolean()

// --- Tests ---

describe('Feature: single-use-link, Property 4: Idempotent duplicate confirmation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * For any link (single-use or multi-use) receiving the same payment
   * confirmation twice (same txHash):
   * - First call: returns { success: true } (no duplicate field or duplicate: false)
   * - Second call: returns { success: true, duplicate: true }
   * - UPDATE is only called once (on the first call, not on the duplicate)
   *
   * **Validates: Requirements 2.4**
   */
  it('second confirmation with same txHash returns duplicate: true and skips UPDATE', async () => {
    let updateCallCount = 0

    // Mock link-events to no-op
    vi.doMock('@/lib/link-events', () => ({
      logLinkEvent: vi.fn().mockResolvedValue(undefined),
      hashIp: vi.fn().mockReturnValue('mockedhash'),
      truncateUserAgent: vi.fn().mockImplementation((ua: string) => ua),
    }))

    // Mock tx-cache to no-op
    vi.doMock('@/lib/tx-cache', () => ({
      upsertTransactions: vi.fn().mockResolvedValue(undefined),
    }))

    // Mock rate limiter to always allow
    vi.doMock('@/lib/rate-limit', () => ({
      createRateLimiter: () => ({
        check: () => ({ allowed: true, retryAfter: 0 }),
      }),
    }))

    let mockLinkRow: Record<string, unknown> = {}

    // Track which call we're on (first vs second POST)
    // selectCallCount tracks DB selects across both calls
    let selectCallCount = 0
    // isDuplicateCall controls whether the linkEvents check returns a row
    let isDuplicateCall = false

    const smartMockDb = {
      select: () => ({
        from: (_table: unknown) => ({
          where: (..._args: unknown[]) => ({
            limit: () => {
              selectCallCount++
              // Odd selects = paymentLinks lookup, even selects = linkEvents dup check
              if (selectCallCount % 2 === 1) {
                // paymentLinks lookup — always return the link
                return Promise.resolve([mockLinkRow])
              }
              // linkEvents duplicate check
              if (isDuplicateCall) {
                // Second call: return existing event row (duplicate detected)
                return Promise.resolve([{ id: 'existing-event' }])
              }
              // First call: return empty (not a duplicate)
              return Promise.resolve([])
            },
          }),
        }),
      }),
      update: () => ({
        set: (_setValues: Record<string, unknown>) => {
          updateCallCount++
          return {
            where: (..._args: unknown[]) => Promise.resolve(),
          }
        },
      }),
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({
            catch: () => Promise.resolve(),
          }),
          catch: () => Promise.resolve(),
        }),
      }),
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => smartMockDb,
      db: smartMockDb,
    }))

    const { POST } = await import('../../links/[id]/route')

    await fc.assert(
      fc.asyncProperty(
        linkIdArb,
        ethAddressArb,
        chainTokenArb,
        txHashArb,
        ethAddressArb,
        amountArb,
        singleUseArb,
        async (linkId, recipient, { chainId, token }, txHash, payerAddress, amount, singleUse) => {
          // Reset per-iteration state
          updateCallCount = 0
          selectCallCount = 0
          isDuplicateCall = false

          // Set up mock link row
          mockLinkRow = {
            id: 'mock-uuid',
            linkId,
            ownerAddress: recipient,
            recipient,
            token,
            chainId,
            amount,
            memo: '',
            expiresAt: null,
            signature: 'mock-sig',
            viewCount: 0,
            payCount: 0,
            singleUse,
            isActive: true,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          // --- First call: should succeed normally ---
          const req1 = new NextRequest(
            `http://localhost:3000/api/links/${linkId}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ txHash, payerAddress, amount, token }),
            },
          )

          const res1 = await POST(req1, {
            params: Promise.resolve({ id: linkId }),
          })

          expect(res1.status).toBe(200)
          const json1 = await res1.json()
          expect(json1.success).toBe(true)
          // First call should NOT have duplicate: true
          expect(json1.duplicate).toBeUndefined()

          const updatesAfterFirst = updateCallCount

          // --- Second call: same txHash → should return duplicate ---
          isDuplicateCall = true

          const req2 = new NextRequest(
            `http://localhost:3000/api/links/${linkId}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ txHash, payerAddress, amount, token }),
            },
          )

          const res2 = await POST(req2, {
            params: Promise.resolve({ id: linkId }),
          })

          expect(res2.status).toBe(200)
          const json2 = await res2.json()
          expect(json2.success).toBe(true)
          expect(json2.duplicate).toBe(true)

          // UPDATE should NOT have been called again on the duplicate
          expect(updateCallCount).toBe(updatesAfterFirst)
        },
      ),
      { numRuns: 100 },
    )
  })
})
