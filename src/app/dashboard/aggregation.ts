import type { FeeTx } from '@/app/api/fees/[address]/route'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'
import type { SavedLink } from '@/lib/validate-storage'
import { formatUnits } from 'viem'

// --- Dashboard tab helpers ---

export type DashboardTab = 'links' | 'history' | 'fees'

export function getVisibleTabs(isCompany: boolean): DashboardTab[] {
  const base: DashboardTab[] = ['links', 'history']
  return isCompany ? [...base, 'fees'] : base
}

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

// --- Task 1.1: filterTransactions ---

export type TxFilter = {
  token: string | null       // null = all
  direction: 'in' | 'out' | null  // null = all
  startDate: number | null   // unix timestamp (seconds)
  endDate: number | null     // unix timestamp (seconds)
}

export function filterTransactions(txs: UnifiedTx[], filter: TxFilter): UnifiedTx[] {
  return txs.filter(tx => {
    if (filter.token && (tx.tokenSymbol ?? 'ETH') !== filter.token) return false
    if (filter.direction && tx.direction !== filter.direction) return false
    const ts = Number(tx.timeStamp)
    if (filter.startDate && ts < filter.startDate) return false
    if (filter.endDate && ts > filter.endDate) return false
    return true
  })
}

// --- Task 1.2: getLinkStatus ---

export function getLinkStatus(
  expiryDate: number | undefined,
  now: number
): 'active' | 'expired' {
  if (expiryDate === undefined) return 'active'
  return now < expiryDate ? 'active' : 'expired'
}

// --- Task 1.3: aggregateSentTotals ---

export function aggregateSentTotals(txs: UnifiedTx[]): Record<string, bigint> {
  const totals: Record<string, bigint> = {}
  for (const tx of txs) {
    if (tx.direction !== 'out') continue
    const token = tx.tokenSymbol ?? 'ETH'
    const value = BigInt(tx.value)
    totals[token] = (totals[token] ?? 0n) + value
  }
  return totals
}

// --- Task 1.4: aggregateByDay ---

export function aggregateByDay(txs: UnifiedTx[]): { date: string; total: bigint }[] {
  const map: Record<string, bigint> = {}
  for (const tx of txs) {
    if (tx.direction !== 'in') continue
    const d = new Date(Number(tx.timeStamp) * 1000)
    const key = d.toISOString().slice(0, 10)
    const value = BigInt(tx.value)
    map[key] = (map[key] ?? 0n) + value
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }))
}

// --- Task 1.5: buildCsvContent ---

export function buildCsvContent(txs: UnifiedTx[]): string {
  const header = 'Date,Direction,Amount,Token,From,To,TX Hash'
  const rows = txs.map(tx => {
    const date = new Date(Number(tx.timeStamp) * 1000).toISOString().slice(0, 19)
    const token = tx.tokenSymbol ?? 'ETH'
    const decimals = tx.tokenDecimal ? parseInt(tx.tokenDecimal) : 18
    const amount = formatUnits(BigInt(tx.value), decimals)
    return `${date},${tx.direction},${amount},${token},${tx.from},${tx.to},${tx.hash}`
  })
  return [header, ...rows].join('\n')
}

// --- Task 1.6: matchTxToLink ---

export function matchTxToLink(link: SavedLink, txs: UnifiedTx[]): UnifiedTx | null {
  const candidates = txs.filter(tx => {
    if (tx.direction !== 'in') return false
    if (Number(tx.timeStamp) < link.createdAt / 1000) return false
    const txToken = tx.tokenSymbol ?? 'ETH'
    if (txToken !== link.token) return false
    return true
  })
  if (candidates.length === 0) return null
  return candidates.reduce((earliest, tx) =>
    Number(tx.timeStamp) < Number(earliest.timeStamp) ? tx : earliest
  )
}

// --- Fee aggregation (moved from fees/aggregation.ts) ---

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
