import { describe, it, expect } from 'vitest'
import type { FeeTx } from '@/app/api/fees/[address]/route'
import { aggregateFeeTotals } from '../../aggregation'

describe('aggregateFeeTotals', () => {
  it('returns empty totals and count 0 for an empty list', () => {
    const result = aggregateFeeTotals([])
    expect(result).toEqual({ totals: {}, count: 0 })
  })

  it('sums ETH fee amounts when tokenSymbol is undefined', () => {
    const txs: FeeTx[] = [
      { hash: '0xabc', payer: '0x1', payee: '', feeAmount: '1000', timeStamp: '1700000000' },
      { hash: '0xdef', payer: '0x2', payee: '', feeAmount: '2000', timeStamp: '1700000001' },
    ]
    const { totals, count } = aggregateFeeTotals(txs)
    expect(totals).toEqual({ ETH: 3000n })
    expect(count).toBe(2)
  })

  it('sums per token type for mixed ETH and ERC-20 transactions', () => {
    const txs: FeeTx[] = [
      { hash: '0x1', payer: '0xa', payee: '', feeAmount: '500', timeStamp: '1700000000' },
      { hash: '0x2', payer: '0xb', payee: '', feeAmount: '300', tokenSymbol: 'USDC', tokenDecimal: '6', timeStamp: '1700000001' },
      { hash: '0x3', payer: '0xc', payee: '', feeAmount: '200', timeStamp: '1700000002' },
      { hash: '0x4', payer: '0xd', payee: '', feeAmount: '100', tokenSymbol: 'USDC', tokenDecimal: '6', timeStamp: '1700000003' },
    ]
    const { totals, count } = aggregateFeeTotals(txs)
    expect(totals).toEqual({ ETH: 700n, USDC: 400n })
    expect(count).toBe(4)
  })

  it('handles a single transaction', () => {
    const txs: FeeTx[] = [
      { hash: '0x1', payer: '0xa', payee: '', feeAmount: '999', tokenSymbol: 'DAI', tokenDecimal: '18', timeStamp: '1700000000' },
    ]
    const { totals, count } = aggregateFeeTotals(txs)
    expect(totals).toEqual({ DAI: 999n })
    expect(count).toBe(1)
  })
})
