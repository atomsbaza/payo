import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  buildTransferCompletedPayload,
  buildLinkCreatedPayload,
  buildLinkDeactivatedPayload,
} from '@/lib/webhookPayload'

// Feature: n8n-webhook, Property 4: Payload structure completeness

/**
 * Property 4: Payload structure completeness
 *
 * For any webhook event type and valid event-specific data, the constructed
 * WebhookPayload SHALL contain: (a) an `event` field matching the event type,
 * (b) a `timestamp` field that is a valid ISO 8601 string, (c) a `linkId`
 * field that is a non-empty string, and (d) a `data` object containing all
 * required fields for that event type.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map(chars => '0x' + chars.join(''))

const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map(chars => '0x' + chars.join(''))

const linkIdArb = fc.string({ minLength: 1, maxLength: 64 })

const amountArb = fc
  .tuple(
    fc.integer({ min: 0, max: 999999 }),
    fc.integer({ min: 0, max: 999999999 }),
  )
  .map(([whole, frac]) => `${whole}.${frac}`)

const paymentCompletedDataArb = fc.record({
  payerAddress: ethAddressArb,
  recipientAddress: ethAddressArb,
  amount: amountArb,
  token: fc.string({ minLength: 1, maxLength: 10 }),
  chainId: fc.integer({ min: 1, max: 999999 }),
  txHash: txHashArb,
  memo: fc.string({ minLength: 0, maxLength: 100 }),
})

const linkCreatedDataArb = fc.record({
  linkId: linkIdArb,
  recipientAddress: ethAddressArb,
  token: fc.string({ minLength: 1, maxLength: 10 }),
  chainId: fc.integer({ min: 1, max: 999999 }),
  amount: amountArb,
  memo: fc.string({ minLength: 0, maxLength: 100 }),
  singleUse: fc.boolean(),
})

const linkDeactivatedDataArb = fc.record({
  linkId: linkIdArb,
  reason: fc.constantFrom('single_use_paid' as const, 'manual_deactivation' as const),
})

// --- Helpers ---

function isValidIso8601(s: string): boolean {
  const d = new Date(s)
  return !isNaN(d.getTime()) && d.toISOString() === s
}

// --- Tests ---

describe('Feature: n8n-webhook, Property 4: Payload structure completeness', () => {
  it('transfer_completed payload has correct event, valid timestamp, non-empty linkId, and all required data fields', () => {
    fc.assert(
      fc.property(linkIdArb, paymentCompletedDataArb, (linkId, data) => {
        const payload = buildTransferCompletedPayload(linkId, data)

        // (a) event field matches event type
        expect(payload.event).toBe('transfer_completed')

        // (b) timestamp is valid ISO 8601
        expect(isValidIso8601(payload.timestamp)).toBe(true)

        // (c) linkId is non-empty string
        expect(typeof payload.linkId).toBe('string')
        expect(payload.linkId.length).toBeGreaterThan(0)

        // (d) data contains all required fields for payment_completed
        const d = payload.data as Record<string, unknown>
        expect(d).toHaveProperty('payerAddress')
        expect(d).toHaveProperty('recipientAddress')
        expect(d).toHaveProperty('amount')
        expect(d).toHaveProperty('token')
        expect(d).toHaveProperty('chainId')
        expect(d).toHaveProperty('txHash')
        expect(d).toHaveProperty('memo')
      }),
      { numRuns: 100 },
    )
  })

  it('link_created payload has correct event, valid timestamp, non-empty linkId, and all required data fields', () => {
    fc.assert(
      fc.property(linkIdArb, linkCreatedDataArb, (linkId, data) => {
        const payload = buildLinkCreatedPayload(linkId, data)

        // (a) event field matches event type
        expect(payload.event).toBe('link_created')

        // (b) timestamp is valid ISO 8601
        expect(isValidIso8601(payload.timestamp)).toBe(true)

        // (c) linkId is non-empty string
        expect(typeof payload.linkId).toBe('string')
        expect(payload.linkId.length).toBeGreaterThan(0)

        // (d) data contains all required fields for link_created
        const d = payload.data as Record<string, unknown>
        expect(d).toHaveProperty('linkId')
        expect(d).toHaveProperty('recipientAddress')
        expect(d).toHaveProperty('token')
        expect(d).toHaveProperty('chainId')
        expect(d).toHaveProperty('amount')
        expect(d).toHaveProperty('memo')
        expect(d).toHaveProperty('singleUse')
      }),
      { numRuns: 100 },
    )
  })

  it('link_deactivated payload has correct event, valid timestamp, non-empty linkId, and all required data fields', () => {
    fc.assert(
      fc.property(linkIdArb, linkDeactivatedDataArb, (linkId, data) => {
        const payload = buildLinkDeactivatedPayload(linkId, data)

        // (a) event field matches event type
        expect(payload.event).toBe('link_deactivated')

        // (b) timestamp is valid ISO 8601
        expect(isValidIso8601(payload.timestamp)).toBe(true)

        // (c) linkId is non-empty string
        expect(typeof payload.linkId).toBe('string')
        expect(payload.linkId.length).toBeGreaterThan(0)

        // (d) data contains all required fields for link_deactivated
        const d = payload.data as Record<string, unknown>
        expect(d).toHaveProperty('linkId')
        expect(d).toHaveProperty('reason')
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: n8n-webhook, Property 5: Payload JSON round-trip

/**
 * Property 5: Payload JSON round-trip
 *
 * For any valid WebhookPayload object, `JSON.parse(JSON.stringify(payload))`
 * SHALL produce an object deeply equal to the original payload.
 *
 * **Validates: Requirements 2.8**
 */

describe('Feature: n8n-webhook, Property 5: Payload JSON round-trip', () => {
  it('transfer_completed payload survives JSON round-trip', () => {
    fc.assert(
      fc.property(linkIdArb, paymentCompletedDataArb, (linkId, data) => {
        const payload = buildTransferCompletedPayload(linkId, data)
        const roundTripped = JSON.parse(JSON.stringify(payload))
        expect(roundTripped).toEqual(payload)
      }),
      { numRuns: 100 },
    )
  })

  it('link_created payload survives JSON round-trip', () => {
    fc.assert(
      fc.property(linkIdArb, linkCreatedDataArb, (linkId, data) => {
        const payload = buildLinkCreatedPayload(linkId, data)
        const roundTripped = JSON.parse(JSON.stringify(payload))
        expect(roundTripped).toEqual(payload)
      }),
      { numRuns: 100 },
    )
  })

  it('link_deactivated payload survives JSON round-trip', () => {
    fc.assert(
      fc.property(linkIdArb, linkDeactivatedDataArb, (linkId, data) => {
        const payload = buildLinkDeactivatedPayload(linkId, data)
        const roundTripped = JSON.parse(JSON.stringify(payload))
        expect(roundTripped).toEqual(payload)
      }),
      { numRuns: 100 },
    )
  })
})
