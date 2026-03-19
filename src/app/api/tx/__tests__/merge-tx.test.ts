import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { mergeTxLists, UnifiedTx } from '../[address]/route'

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

const directionArb = fc.constantFrom('in' as const, 'out' as const)

// Arbitrary: ETH transaction (no tokenSymbol/tokenDecimal)
const ethTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }).map(String),
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  direction: directionArb,
})

// Arbitrary: ERC-20 transaction (with tokenSymbol and tokenDecimal)
const erc20TxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }).map(String),
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  tokenSymbol: fc.constant('USDC'),
  tokenDecimal: fc.constant('6'),
  direction: directionArb,
})

describe('mergeTxLists', () => {
  /**
   * Property 1: Merged TX list is sorted by timestamp descending
   */
  it('merged TX list is always sorted by timestamp descending', () => {
    fc.assert(
      fc.property(
        fc.array(ethTxArb, { minLength: 0, maxLength: 15 }),
        fc.array(erc20TxArb, { minLength: 0, maxLength: 15 }),
        (ethTxs, erc20Txs) => {
          const merged = mergeTxLists(ethTxs, erc20Txs)

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

  it('limits output to 50 transactions by default', () => {
    fc.assert(
      fc.property(
        fc.array(ethTxArb, { minLength: 25, maxLength: 30 }),
        fc.array(erc20TxArb, { minLength: 25, maxLength: 30 }),
        (ethTxs, erc20Txs) => {
          const merged = mergeTxLists(ethTxs, erc20Txs)
          expect(merged.length).toBeLessThanOrEqual(50)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('deduplicates by hash+direction', () => {
    const tx: UnifiedTx = {
      hash: '0x' + 'a'.repeat(64),
      from: '0x' + '1'.repeat(40),
      to: '0x' + '2'.repeat(40),
      value: '1000',
      timeStamp: '1700000000',
      isError: '0',
      direction: 'in',
    }
    const merged = mergeTxLists([tx], [tx])
    expect(merged.length).toBe(1)
  })
})
