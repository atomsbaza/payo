import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Feature: single-use-link, Property 5: Deactivated link GET response includes status fields
 *
 * For any link where `is_active = false`, the GET `/api/links/[id]` response
 * SHALL include `isActive: false` and `deactivatedAt` as a non-null ISO string.
 *
 * **Validates: Requirements 3.1**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
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

/** Random link ID (alphanumeric, not starting with "demo") */
const linkIdArb = fc
  .string({ minLength: 8, maxLength: 32, unit: 'grapheme' })
  .filter((s) => /^[a-zA-Z0-9]+$/.test(s) && !s.toLowerCase().startsWith('demo'))

/** Random past date for deactivatedAt (valid dates only) */
const deactivatedAtArb = fc
  .date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
  .filter((d) => !isNaN(d.getTime()))

/** singleUse: true or false (both can be deactivated) */
const singleUseArb = fc.boolean()

// --- Tests ---

describe('Feature: single-use-link, Property 5: Deactivated link GET response includes status fields', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * For any deactivated link (isActive=false, deactivatedAt set),
   * GET response must include isActive: false, non-null deactivatedAt ISO string,
   * and singleUse field.
   *
   * **Validates: Requirements 3.1**
   */
  it('GET response for deactivated link includes isActive: false, non-null deactivatedAt, and singleUse', async () => {
    let mockLinkRow: Record<string, unknown> = {}

    // Mock link-events to no-op
    vi.doMock('@/lib/link-events', () => ({
      logLinkEvent: vi.fn().mockResolvedValue(undefined),
      hashIp: vi.fn().mockReturnValue('mockedhash'),
      truncateUserAgent: vi.fn().mockImplementation((ua: string) => ua),
    }))

    // Mock encode — isDemoLink returns false for our generated IDs
    vi.doMock('@/lib/encode', () => ({
      isDemoLink: () => false,
      DEMO_PAYMENT_DATA: {},
      decodePaymentLink: () => null,
    }))

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockLinkRow]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    }

    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => mockDb,
      db: mockDb,
    }))

    const { GET } = await import('../[id]/route')

    await fc.assert(
      fc.asyncProperty(
        linkIdArb,
        ethAddressArb,
        chainTokenArb,
        amountArb,
        deactivatedAtArb,
        singleUseArb,
        async (linkId, recipient, { chainId, token }, amount, deactivatedAt, singleUse) => {
          // Set up mock row as a deactivated link
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
            viewCount: 5,
            payCount: 1,
            singleUse,
            isActive: false,
            deactivatedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const req = new NextRequest(
            `http://localhost:3000/api/links/${linkId}`,
            { method: 'GET' },
          )

          const res = await GET(req, {
            params: Promise.resolve({ id: linkId }),
          })

          expect(res.status).toBe(200)
          const json = await res.json()

          // isActive must be false
          expect(json.isActive).toBe(false)

          // deactivatedAt must be a non-null string (ISO format)
          expect(json.deactivatedAt).not.toBeNull()
          expect(typeof json.deactivatedAt).toBe('string')
          // Verify it's a valid ISO date string
          expect(new Date(json.deactivatedAt).toISOString()).toBe(json.deactivatedAt)

          // singleUse must be present as a boolean
          expect(typeof json.singleUse).toBe('boolean')
          expect(json.singleUse).toBe(singleUse)
        },
      ),
      { numRuns: 100 },
    )
  })
})
