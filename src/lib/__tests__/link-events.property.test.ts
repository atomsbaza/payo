import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { hashIp, truncateUserAgent } from '../link-events'

/**
 * Feature: database-integration, Property 13: Event logging correctness
 *
 * For any link event (viewed, paid, expired, tamper_blocked), logging the event
 * should produce a row in `link_events` with the correct `event_type`, and:
 * - for 'viewed' events, `ip_hash` should be a valid 64-character hex string
 *   (SHA-256) and `user_agent` should be truncated to at most 512 characters;
 * - for 'paid' events, `payer_address` and `tx_hash` should be non-null;
 * - for 'tamper_blocked' events, the row should exist with the correct type.
 * - Optional fields default to null when not provided.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */

// --- Mocks ---

vi.mock('../db', () => ({
  isDatabaseConfigured: vi.fn(() => true),
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}))

import { isDatabaseConfigured, db } from '../db'
import { logLinkEvent } from '../link-events'

/** Wire a fresh mock values fn to db.insert and return it */
function setupInsertMock() {
  const valuesFn = vi.fn(() => Promise.resolve())
  vi.mocked(db.insert).mockReturnValue({ values: valuesFn } as unknown as ReturnType<typeof db.insert>)
  return valuesFn
}

// --- Arbitraries ---

const eventTypeArb = fc.constantFrom('viewed', 'paid', 'expired', 'tamper_blocked' as const)

const linkIdArb = fc.string({ minLength: 1, maxLength: 100 })

const ipArb = fc.oneof(
  // IPv4-like
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
  // Arbitrary string (covers IPv6, garbage, etc.)
  fc.string({ minLength: 1, maxLength: 200 }),
)

const userAgentArb = fc.string({ minLength: 0, maxLength: 2000 })

const ethAddressArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const txHashArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)


describe('Feature: database-integration, Property 13: Event logging correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  /**
   * hashIp() always produces a 64-character lowercase hex string for any input.
   * **Validates: Requirements 7.1, 7.4**
   */
  it('hashIp always produces a 64-char lowercase hex string for any input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (input) => {
        const hashed = hashIp(input)
        expect(hashed).toMatch(/^[0-9a-f]{64}$/)
        expect(hashed).toHaveLength(64)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * truncateUserAgent() always returns a string ≤ 512 characters for any input.
   * **Validates: Requirements 7.1**
   */
  it('truncateUserAgent always returns a string ≤ 512 characters for any input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 5000 }), (input) => {
        const result = truncateUserAgent(input)
        expect(result.length).toBeLessThanOrEqual(512)
        // If input was short enough, it should be unchanged
        if (input.length <= 512) {
          expect(result).toBe(input)
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * For 'viewed' events: ip_hash is hashed (64-char hex), user_agent is truncated.
   * **Validates: Requirements 7.1, 7.4**
   */
  it('viewed events: ip_hash is a 64-char hex and user_agent ≤ 512 chars', () => {
    fc.assert(
      fc.asyncProperty(linkIdArb, ipArb, userAgentArb, async (linkId, ip, ua) => {
        const valuesFn = setupInsertMock()

        await logLinkEvent({
          linkId,
          eventType: 'viewed',
          ipHash: ip,
          userAgent: ua,
        })

        expect(db.insert).toHaveBeenCalled()
        expect(valuesFn).toHaveBeenCalledOnce()

        const row = (valuesFn.mock.calls as unknown[][])[0][0] as Record<string, unknown>

        expect(row.eventType).toBe('viewed')
        expect(row.linkId).toBe(linkId)
        // ip_hash must be a 64-char lowercase hex (SHA-256), not the raw IP
        expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/)
        expect(row.ipHash).not.toBe(ip)
        // user_agent must be ≤ 512 chars (empty string is stored as null)
        if (ua === '') {
          expect(row.userAgent).toBeNull()
        } else {
          expect((row.userAgent as string).length).toBeLessThanOrEqual(512)
        }
      }),
      { numRuns: 100 },
    )
  })

  /**
   * For 'paid' events: payerAddress and txHash are passed through.
   * **Validates: Requirements 7.2**
   */
  it('paid events: payerAddress and txHash are passed through correctly', () => {
    fc.assert(
      fc.asyncProperty(linkIdArb, ethAddressArb, txHashArb, async (linkId, payer, tx) => {
        const valuesFn = setupInsertMock()

        await logLinkEvent({
          linkId,
          eventType: 'paid',
          payerAddress: payer,
          txHash: tx,
        })

        expect(valuesFn).toHaveBeenCalledOnce()

        const row = (valuesFn.mock.calls as unknown[][])[0][0] as Record<string, unknown>

        expect(row.eventType).toBe('paid')
        expect(row.linkId).toBe(linkId)
        expect(row.payerAddress).toBe(payer)
        expect(row.txHash).toBe(tx)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * For 'tamper_blocked' events: the row exists with correct type.
   * **Validates: Requirements 7.3**
   */
  it('tamper_blocked events: row is inserted with correct event type', () => {
    fc.assert(
      fc.asyncProperty(linkIdArb, async (linkId) => {
        const valuesFn = setupInsertMock()

        await logLinkEvent({
          linkId,
          eventType: 'tamper_blocked',
        })

        expect(valuesFn).toHaveBeenCalledOnce()

        const row = (valuesFn.mock.calls as unknown[][])[0][0] as Record<string, unknown>

        expect(row.eventType).toBe('tamper_blocked')
        expect(row.linkId).toBe(linkId)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Optional fields default to null when not provided.
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   */
  it('optional fields default to null when not provided for any event type', () => {
    fc.assert(
      fc.asyncProperty(eventTypeArb, linkIdArb, async (eventType, linkId) => {
        const valuesFn = setupInsertMock()

        await logLinkEvent({ linkId, eventType })

        expect(valuesFn).toHaveBeenCalledOnce()

        const row = (valuesFn.mock.calls as unknown[][])[0][0] as Record<string, unknown>

        expect(row.eventType).toBe(eventType)
        expect(row.linkId).toBe(linkId)
        expect(row.payerAddress).toBeNull()
        expect(row.txHash).toBeNull()
        expect(row.ipHash).toBeNull()
        expect(row.userAgent).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * logLinkEvent passes correct fields to db.insert for all event types with random data.
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   */
  it('logLinkEvent passes correct fields to db.insert for any event type with random data', () => {
    fc.assert(
      fc.asyncProperty(
        eventTypeArb,
        linkIdArb,
        fc.option(ethAddressArb),
        fc.option(txHashArb),
        fc.option(ipArb),
        fc.option(userAgentArb),
        async (eventType, linkId, payerAddress, txHash, ip, ua) => {
          const valuesFn = setupInsertMock()

          await logLinkEvent({
            linkId,
            eventType,
            payerAddress: payerAddress ?? undefined,
            txHash: txHash ?? undefined,
            ipHash: ip ?? undefined,
            userAgent: ua ?? undefined,
          })

          expect(valuesFn).toHaveBeenCalledOnce()

          const row = (valuesFn.mock.calls as unknown[][])[0][0] as Record<string, unknown>

          // eventType and linkId always match
          expect(row.eventType).toBe(eventType)
          expect(row.linkId).toBe(linkId)

          // payerAddress and txHash are passed through or null
          expect(row.payerAddress).toBe(payerAddress ?? null)
          expect(row.txHash).toBe(txHash ?? null)

          // ipHash: if provided, must be 64-char hex (hashed); if not, null
          if (ip != null) {
            expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/)
          } else {
            expect(row.ipHash).toBeNull()
          }

          // userAgent: if provided and non-empty, must be ≤ 512 chars; empty string or null → null
          if (ua != null && ua !== '') {
            expect((row.userAgent as string).length).toBeLessThanOrEqual(512)
          } else {
            expect(row.userAgent).toBeNull()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
