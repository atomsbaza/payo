// Feature: transaction-fee, Property 7: Fee aggregation correctness
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { FeeTx } from '@/app/api/fees/[address]/route'
import { aggregateFeeTotals } from '../aggregation'

// Arbitrary: hex characters for building hashes/addresses
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const timestampArb = fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }).map(String)

// Fee amount as bigint string (0 to 10^18)
const feeAmountArb = fc.bigInt({ min: 0n, max: 10n ** 18n }).map(String)

// Token type: ETH (no tokenSymbol), USDC, or DAI
const tokenTypeArb = fc.constantFrom('ETH', 'USDC', 'DAI')

// Build a FeeTx from a chosen token type
const feeTxArb: fc.Arbitrary<FeeTx> = fc
  .record({
    hash: txHashArb,
    payer: ethAddressArb,
    payee: fc.constant(''),
    feeAmount: feeAmountArb,
    timeStamp: timestampArb,
    tokenType: tokenTypeArb,
  })
  .map(({ tokenType, ...rest }) => {
    if (tokenType === 'ETH') {
      // ETH transactions have no tokenSymbol
      return { ...rest } as FeeTx
    }
    return {
      ...rest,
      tokenSymbol: tokenType,
      tokenDecimal: tokenType === 'USDC' ? '6' : '18',
    } as FeeTx
  })

describe('aggregateFeeTotals — Property 7: Fee aggregation correctness', () => {
  /**
   * Property 7a: Total transaction count equals input length
   * **Validates: Requirements 5.1, 5.2**
   */
  it('count equals input length for any list of fee transactions', () => {
    fc.assert(
      fc.property(
        fc.array(feeTxArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const { count } = aggregateFeeTotals(txs)
          expect(count).toBe(txs.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7b: Per-token totals equal the sum of matching feeAmounts
   * **Validates: Requirements 5.1, 5.2**
   */
  it('per-token totals equal the sum of matching feeAmounts', () => {
    fc.assert(
      fc.property(
        fc.array(feeTxArb, { minLength: 1, maxLength: 50 }),
        (txs) => {
          const { totals } = aggregateFeeTotals(txs)

          // Manually compute expected totals per token
          const expected: Record<string, bigint> = {}
          for (const tx of txs) {
            const token = tx.tokenSymbol ?? 'ETH'
            const value = BigInt(tx.feeAmount)
            expected[token] = (expected[token] ?? 0n) + value
          }

          // Remove tokens whose total is 0 (aggregateFeeTotals includes them, so we keep them)
          // Actually, aggregateFeeTotals always adds, so 0n entries will exist if all feeAmounts are "0"
          // We compare all keys from both sides

          const allTokens = new Set([...Object.keys(totals), ...Object.keys(expected)])
          for (const token of allTokens) {
            expect(totals[token]).toBe(expected[token])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
