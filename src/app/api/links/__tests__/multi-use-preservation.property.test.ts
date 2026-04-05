import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: single-use-link, Property 3: Multi-use link preservation (no deactivation)
 *
 * For any payment link where `single_use = false` (including pre-existing links),
 * after a valid (non-duplicate) payment confirmation, the link SHALL have
 * `is_active` unchanged (still `true`) and `pay_count` incremented by 1.
 * This ensures backward compatibility — links created before this feature are
 * never auto-deactivated.
 *
 * **Validates: Requirements 2.2, 5.4**
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

// --- Tests ---

describe('Feature: single-use-link, Property 3: Multi-use link preservation (no deactivation)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * For any multi-use link (singleUse=false, isActive=true) receiving a
   * valid payment confirmation, the UPDATE call must NOT set isActive=false,
   * must NOT set deactivatedAt, and must increment payCount.
   *
   * **Validates: Requirements 2.2, 5.4**
   */
  it('does not deactivate multi-use link on payment confirmation', async () => {
    // Captured UPDATE set values for assertion
    let capturedUpdateSet: Record<string, unknown> | null = null
    let capturedUpdateWhereUsed = false

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

    // Track select call count to distinguish link lookup vs duplicate check
    let selectCallCount = 0

    const smartMockDb = {
      select: () => ({
        from: (_table: unknown) => ({
          where: (..._args: unknown[]) => ({
            limit: () => {
              selectCallCount++
              if (selectCallCount % 2 === 1) {
                // First select: paymentLinks lookup
                return Promise.resolve([mockLinkRow])
              }
              // Second select: linkEvents duplicate check — return empty (not a duplicate)
              return Promise.resolve([])
            },
          }),
        }),
      }),
      update: () => ({
        set: (setValues: Record<string, unknown>) => {
          capturedUpdateSet = setValues
          return {
            where: (..._args: unknown[]) => {
              capturedUpdateWhereUsed = true
              return Promise.resolve()
            },
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

    const { POST } = await import('../[id]/route')

    await fc.assert(
      fc.asyncProperty(
        linkIdArb,
        ethAddressArb,
        chainTokenArb,
        txHashArb,
        ethAddressArb,
        amountArb,
        async (linkId, recipient, { chainId, token }, txHash, payerAddress, amount) => {
          // Reset per-iteration state
          capturedUpdateSet = null
          capturedUpdateWhereUsed = false
          selectCallCount = 0

          // Set up the mock link row as a multi-use, active link (singleUse = false)
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
            singleUse: false,
            isActive: true,
            deactivatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const req = new NextRequest(
            `http://localhost:3000/api/links/${linkId}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ txHash, payerAddress, amount, token }),
            },
          )

          const res = await POST(req, {
            params: Promise.resolve({ id: linkId }),
          })

          // Should succeed
          expect(res.status).toBe(200)
          const json = await res.json()
          expect(json.success).toBe(true)

          // The UPDATE must have been called
          expect(capturedUpdateSet).not.toBeNull()

          // isActive must NOT be set to false (multi-use links stay active)
          expect(capturedUpdateSet!.isActive).not.toBe(false)

          // deactivatedAt must NOT be set (no deactivation for multi-use)
          expect(capturedUpdateSet!.deactivatedAt).toBeUndefined()

          // payCount must be the SQL increment expression (sql`pay_count + 1`)
          // Drizzle wraps sql`` in an object; we check it's truthy (not undefined)
          expect(capturedUpdateSet!.payCount).toBeTruthy()

          // WHERE clause must have been used
          expect(capturedUpdateWhereUsed).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
