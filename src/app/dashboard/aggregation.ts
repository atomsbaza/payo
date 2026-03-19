import type { UnifiedTx } from '@/app/api/tx/[address]/route'

/**
 * Aggregate total received amounts per token type from a list of unified transactions.
 * Only counts incoming transactions (direction === 'in').
 * Returns a Record mapping token name (e.g. "ETH", "USDC") to the sum of raw values (as bigint).
 */
export function aggregateTotals(txs: UnifiedTx[]): Record<string, bigint> {
  const totals: Record<string, bigint> = {}
  for (const tx of txs) {
    if (tx.direction && tx.direction !== 'in') continue
    const token = tx.tokenSymbol ?? 'ETH'
    const value = BigInt(tx.value)
    totals[token] = (totals[token] ?? 0n) + value
  }
  return totals
}
