import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { FeeTx } from '@/app/api/fees/[address]/route'
import { aggregateFeeTotals } from '../aggregation'

/**
 * Feature: dashboard-fees-merge, Property 2: Fee aggregation correctness
 *
 * For any list of FeeTx objects, `aggregateFeeTotals` should return a `count`
 * equal to the input array length, and for each token type, the `totals[token]`
 * should equal the sum of `BigInt(tx.feeAmount)` for all transactions with that
 * token symbol (defaulting to 'ETH' when tokenSymbol is undefined).
 *
 * **Validates: Requirements 2.4, 2.5**
 */

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const timestampArb = fc
  .integer({ min: 1_600_000_000, max: 1_800_000_000 })
  .map(String)

const feeAmountArb = fc.bigInt({ min: 0n, max: 10n ** 18n }).map(String)

const tokenTypeArb = fc.constantFrom('ETH', 'USDC', 'DAI')

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
      return { ...rest } as FeeTx
    }
    return {
      ...rest,
      tokenSymbol: tokenType,
      tokenDecimal: tokenType === 'USDC' ? '6' : '18',
    } as FeeTx
  })

describe('Feature: dashboard-fees-merge, Property 2: Fee aggregation correctness', () => {
  /**
   * count equals input array length for any FeeTx list.
   * **Validates: Requirements 2.5**
   */
  it('count equals txs.length for any list of fee transactions', () => {
    fc.assert(
      fc.property(
        fc.array(feeTxArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const { count } = aggregateFeeTotals(txs)
          expect(count).toBe(txs.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Per-token totals match manual sum of BigInt(tx.feeAmount).
   * **Validates: Requirements 2.4**
   */
  it('per-token totals match manual sum of BigInt(tx.feeAmount)', () => {
    fc.assert(
      fc.property(
        fc.array(feeTxArb, { minLength: 1, maxLength: 50 }),
        (txs) => {
          const { totals } = aggregateFeeTotals(txs)

          const expected: Record<string, bigint> = {}
          for (const tx of txs) {
            const token = tx.tokenSymbol ?? 'ETH'
            const value = BigInt(tx.feeAmount)
            expected[token] = (expected[token] ?? 0n) + value
          }

          const allTokens = new Set([
            ...Object.keys(totals),
            ...Object.keys(expected),
          ])
          for (const token of allTokens) {
            expect(totals[token]).toBe(expected[token])
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
