import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'
import { aggregateTotals } from '../aggregation'

// Arbitrary: valid hex hash
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: valid Ethereum address
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: unix timestamp as string
const timestampArb = fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }).map(String)

// Arbitrary: positive bigint value as string (avoid 0 for meaningful sums)
const valueArb = fc.bigInt({ min: 1n, max: (1n << 64n) - 1n }).map(String)

const directionArb = fc.constantFrom('in' as const, 'out' as const)

// Arbitrary: ETH transaction
const ethTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: valueArb,
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  direction: directionArb,
})

// Arbitrary: USDC (ERC-20) transaction
const usdcTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: valueArb,
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  tokenSymbol: fc.constant('USDC'),
  tokenDecimal: fc.constant('6'),
  direction: directionArb,
})

// Arbitrary: mixed transaction (either ETH or USDC)
const mixedTxArb: fc.Arbitrary<UnifiedTx> = fc.oneof(ethTxArb, usdcTxArb)

describe('aggregateTotals', () => {
  /**
   * Property: Total received aggregation only counts incoming transactions.
   * ETH total equals sum of ETH-only incoming txs, USDC total equals sum of USDC-only incoming txs.
   */
  it('only aggregates incoming transactions, ignoring outgoing', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 1, maxLength: 30 }),
        (txs) => {
          const totals = aggregateTotals(txs)

          // Manually compute expected totals (only 'in' direction)
          let expectedEth = 0n
          let expectedUsdc = 0n
          for (const tx of txs) {
            if (tx.direction !== 'in') continue
            const val = BigInt(tx.value)
            if (tx.tokenSymbol === 'USDC') {
              expectedUsdc += val
            } else {
              expectedEth += val
            }
          }

          if (expectedEth > 0n) {
            expect(totals['ETH']).toBe(expectedEth)
          } else {
            expect(totals['ETH']).toBeUndefined()
          }

          if (expectedUsdc > 0n) {
            expect(totals['USDC']).toBe(expectedUsdc)
          } else {
            expect(totals['USDC']).toBeUndefined()
          }

          const tokenKeys = Object.keys(totals)
          for (const key of tokenKeys) {
            expect(['ETH', 'USDC']).toContain(key)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
