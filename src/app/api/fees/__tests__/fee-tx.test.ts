import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { mergeFeeTxLists, FeeTx } from '../[address]/route'

// Feature: transaction-fee, Property 8: Fee transaction list ordering and cap

// Arbitrary: valid hex hash
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: valid Ethereum address
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: unix timestamp as string (reasonable range)
const timestampArb = fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }).map(String)

// Arbitrary: ETH fee transaction (no tokenSymbol/tokenDecimal)
const ethFeeTxArb: fc.Arbitrary<FeeTx> = fc.record({
  hash: txHashArb,
  payer: ethAddressArb,
  payee: ethAddressArb,
  feeAmount: fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }).map(String),
  timeStamp: timestampArb,
})

// Arbitrary: ERC-20 fee transaction (with tokenSymbol and tokenDecimal)
const erc20FeeTxArb: fc.Arbitrary<FeeTx> = fc.record({
  hash: txHashArb,
  payer: ethAddressArb,
  payee: ethAddressArb,
  feeAmount: fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }).map(String),
  timeStamp: timestampArb,
  tokenSymbol: fc.constant('USDC'),
  tokenDecimal: fc.constant('6'),
})

describe('mergeFeeTxLists', () => {
  /**
   * Property 1: Output is sorted by timestamp descending
   * Validates: Requirements 6.2
   */
  it('output is always sorted by timestamp descending', () => {
    fc.assert(
      fc.property(
        fc.array(ethFeeTxArb, { minLength: 0, maxLength: 30 }),
        fc.array(erc20FeeTxArb, { minLength: 0, maxLength: 30 }),
        (ethTxs, erc20Txs) => {
          const merged = mergeFeeTxLists(ethTxs, erc20Txs)

          for (let i = 1; i < merged.length; i++) {
            expect(Number(merged[i - 1].timeStamp)).toBeGreaterThanOrEqual(
              Number(merged[i].timeStamp)
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Output has at most 50 entries
   * Validates: Requirements 6.4
   */
  it('output has at most 50 entries', () => {
    fc.assert(
      fc.property(
        fc.array(ethFeeTxArb, { minLength: 0, maxLength: 40 }),
        fc.array(erc20FeeTxArb, { minLength: 0, maxLength: 40 }),
        (ethTxs, erc20Txs) => {
          const merged = mergeFeeTxLists(ethTxs, erc20Txs)
          expect(merged.length).toBeLessThanOrEqual(50)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: All output entries come from the input lists
   * Validates: Requirements 6.2, 6.4
   */
  it('all output entries come from the input lists', () => {
    fc.assert(
      fc.property(
        fc.array(ethFeeTxArb, { minLength: 0, maxLength: 30 }),
        fc.array(erc20FeeTxArb, { minLength: 0, maxLength: 30 }),
        (ethTxs, erc20Txs) => {
          const merged = mergeFeeTxLists(ethTxs, erc20Txs)
          const inputHashes = new Set([...ethTxs, ...erc20Txs].map((tx) => tx.hash))

          for (const tx of merged) {
            expect(inputHashes.has(tx.hash)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
