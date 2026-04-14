/**
 * Preservation property tests for the payment-to-transfer rename.
 *
 * These tests import from the CURRENT (unfixed) names and verify that
 * encode/decode, HMAC, and validation behaviour is correct.
 *
 * They MUST PASS on unfixed code (establishing baseline) and MUST also
 * pass after the fix is applied (verifying no regressions).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
 */

import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { encodeTransferLink, decodeTransferLink, DEMO_TRANSFER_DATA } from '@/lib/encode'
import { signTransferLink, verifyTransferLink } from '@/lib/hmac'
import { validateTransferLink } from '@/lib/validate'

/** Arbitrary for valid link data objects */
const validLinkDataArb = fc.record({
  address: fc.constant('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
  token: fc.constantFrom('ETH', 'USDC'),
  amount: fc.constantFrom('', '0.01', '1'),
  memo: fc.string({ maxLength: 100 }),
  chainId: fc.constantFrom(84532, 8453),
})

describe('Preservation: encode/decode round-trip', () => {
  /**
   * Property 1: For all valid link data objects, encode→decode is lossless.
   * Validates: Requirements 3.6
   */
  it('encode→decode round-trip preserves address, token, and chainId', () => {
    fc.assert(
      fc.property(
        fc.record({
          address: fc.constant('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
          token: fc.constantFrom('ETH', 'USDC'),
          amount: fc.constantFrom('', '0.01', '1'),
          memo: fc.string({ maxLength: 100 }),
          chainId: fc.constantFrom(84532, 8453),
        }),
        (data) => {
          const encoded = encodeTransferLink(data)
          const decoded = decodeTransferLink(encoded)
          return (
            decoded?.address === data.address &&
            decoded?.token === data.token &&
            decoded?.chainId === data.chainId
          )
        }
      )
    )
  })
})

describe('Preservation: HMAC sign/verify', () => {
  /**
   * Property 2: For all valid link data, sign then verify always returns true.
   * Validates: Requirements 3.7
   */
  it('sign→verify always returns true for valid data', () => {
    fc.assert(
      fc.property(validLinkDataArb, (data) => {
        const sig = signTransferLink(data)
        return verifyTransferLink({ ...data, signature: sig })
      })
    )
  })
})

describe('Preservation: validation', () => {
  /**
   * Property 3: For all valid link data, validatePaymentLink returns valid: true.
   * Validates: Requirements 3.1, 3.2
   */
  it('accepts valid link data', () => {
    fc.assert(
      fc.property(validLinkDataArb, (data) => {
        const result = validateTransferLink(data)
        return result.valid === true
      })
    )
  })

  /**
   * Property 4: For non-Ethereum addresses, validatePaymentLink returns valid: false.
   * Validates: Requirements 3.1, 3.2
   */
  it('rejects non-Ethereum addresses', () => {
    const baseData = {
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      token: 'ETH',
      amount: '0.01',
      memo: 'test',
      chainId: 84532,
    }
    fc.assert(
      fc.property(fc.string(), (addr) => {
        if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return true
        const result = validateTransferLink({ ...baseData, address: addr })
        return result.valid === false
      })
    )
  })
})

describe('Preservation: DEMO_TRANSFER_DATA round-trip', () => {
  /**
   * Property 5: The demo constant encodes and decodes correctly.
   * Validates: Requirements 3.8
   */
  it('DEMO_TRANSFER_DATA encodes and decodes losslessly', () => {
    const encoded = encodeTransferLink(DEMO_TRANSFER_DATA)
    const decoded = decodeTransferLink(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded?.address).toBe(DEMO_TRANSFER_DATA.address)
    expect(decoded?.token).toBe(DEMO_TRANSFER_DATA.token)
    expect(decoded?.chainId).toBe(DEMO_TRANSFER_DATA.chainId)
    expect(decoded?.amount).toBe(DEMO_TRANSFER_DATA.amount)
    expect(decoded?.memo).toBe(DEMO_TRANSFER_DATA.memo)
  })
})
