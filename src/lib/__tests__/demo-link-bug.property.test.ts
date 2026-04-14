import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { decodeTransferLink, isDemoLink, DEMO_TRANSFER_DATA } from '../encode'

/**
 * Bug Condition Exploration Test — Demo Page Fix (Post-Fix)
 *
 * After the fix:
 * - `decodePaymentLink("demo")` still returns `null` (unchanged)
 * - `isDemoLink` helper NOW EXISTS and correctly identifies "demo"
 * - The actual fix: `isDemoLink(id) ? DEMO_PAYMENT_DATA : decodePaymentLink(id)`
 *   returns valid PaymentLinkData for demo IDs
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2**
 */
describe('Bug Condition: Demo ID — fixed behavior', () => {
  it('decodePaymentLink("demo") still returns null (function unchanged)', () => {
    const result = decodeTransferLink('demo')
    expect(result).toBe(null)
  })

  it('isDemoLink helper now exists and works correctly', async () => {
    const encode = await import('../encode')
    expect('isDemoLink' in encode).toBe(true)
    expect(isDemoLink('demo')).toBe(true)
    expect(isDemoLink('Demo')).toBe(false)
    expect(isDemoLink('')).toBe(false)
    expect(isDemoLink('other')).toBe(false)
  })

  it('Property: for id === "demo", isDemoLink check + DEMO_PAYMENT_DATA returns valid PaymentLinkData', () => {
    fc.assert(
      fc.property(
        fc.constant('demo'),
        (id: string) => {
          // This is the actual fix logic used in pay page and API route
          const result = isDemoLink(id) ? DEMO_TRANSFER_DATA : decodeTransferLink(id)

          expect(result).not.toBe(null)
          expect(result).toHaveProperty('address')
          expect(result).toHaveProperty('token')
          expect(result).toHaveProperty('amount')
          expect(result).toHaveProperty('chainId')
          expect(result!.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
          expect(result!.token).toBe('ETH')
          expect(result!.chainId).toBe(84532)
        }
      ),
      { numRuns: 10 }
    )
  })
})
