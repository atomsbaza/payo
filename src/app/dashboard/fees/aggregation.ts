import type { FeeTx } from '@/app/api/fees/[address]/route'

/**
 * Aggregate fee amounts per token type from a list of fee transactions.
 * ETH transactions have no tokenSymbol; ERC-20 transactions have tokenSymbol set.
 * Returns a Record mapping token name to total fee amount (as bigint), plus the transaction count.
 */
export function aggregateFeeTotals(txs: FeeTx[]): { totals: Record<string, bigint>; count: number } {
  const totals: Record<string, bigint> = {}
  for (const tx of txs) {
    const token = tx.tokenSymbol ?? 'ETH'
    const value = BigInt(tx.feeAmount)
    totals[token] = (totals[token] ?? 0n) + value
  }
  return { totals, count: txs.length }
}
