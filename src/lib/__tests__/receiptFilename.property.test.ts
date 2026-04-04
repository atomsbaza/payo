import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { receiptFilename } from '@/lib/receiptData'

// Feature: payment-receipt, Property 2: Receipt filename format

/**
 * Property 2: Receipt filename format
 *
 * For any valid transaction hash (0x-prefixed, 64 hex chars), the generated
 * filename SHALL match the pattern `payo-receipt-{first 8 hex chars after 0x}.pdf`
 * — i.e., `payo-receipt-` + `txHash.slice(2, 10)` + `.pdf`.
 *
 * **Validates: Requirements 2.3**
 */

// --- Arbitraries ---

/** Hex string of exact length */
const hexStringArb = (len: number) =>
  fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: len, maxLength: len })
    .map(chars => chars.join(''))

/** TX hash: 0x + 64 hex chars */
const txHashArb = hexStringArb(64).map(hex => `0x${hex}`)

// --- Tests ---

describe('Feature: payment-receipt, Property 2: Receipt filename format', () => {
  /**
   * The filename matches `payo-receipt-{txHash.slice(2,10)}.pdf` for any
   * valid transaction hash.
   *
   * **Validates: Requirements 2.3**
   */
  it('filename matches payo-receipt-{first 8 hex chars}.pdf for any valid tx hash', () => {
    fc.assert(
      fc.property(txHashArb, (txHash) => {
        const filename = receiptFilename(txHash)
        const expected = `payo-receipt-${txHash.slice(2, 10)}.pdf`

        expect(filename).toBe(expected)
        expect(filename).toMatch(/^payo-receipt-[0-9a-f]{8}\.pdf$/)
      }),
      { numRuns: 100 },
    )
  })
})
