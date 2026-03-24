import { eq, and, or, gt, lt, sql } from 'drizzle-orm'
import { getDb } from './db'
import { transactions } from './schema'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Query cached transactions for an address on a given chain.
 * Returns null when no fresh rows exist (caller should fetch from Basescan).
 */
export async function getCachedTransactions(
  address: string,
  chainId: number,
  maxAgeMs: number = FIVE_MINUTES_MS,
): Promise<UnifiedTx[] | null> {
  const db = getDb()
  const addr = address.toLowerCase()
  const cutoff = new Date(Date.now() - maxAgeMs)

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        or(
          eq(transactions.toAddress, addr),
          eq(transactions.fromAddress, addr),
        ),
        eq(transactions.chainId, chainId),
        gt(transactions.cachedAt, cutoff),
      ),
    )

  if (rows.length === 0) return null

  return rows.map((r) => ({
    hash: r.txHash,
    from: r.fromAddress,
    to: r.toAddress,
    value: r.value,
    timeStamp: String(Math.floor(r.timestamp.getTime() / 1000)),
    isError: r.isError ? '1' : '0',
    tokenSymbol: r.tokenSymbol ?? undefined,
    tokenDecimal: r.tokenDecimal != null ? String(r.tokenDecimal) : undefined,
    direction: r.direction as 'in' | 'out',
  }))
}

/**
 * Upsert transactions into the cache.
 * Uses ON CONFLICT (tx_hash, chain_id, direction) DO UPDATE to avoid duplicates
 * and refresh cached_at on re-insert.
 */
export async function upsertTransactions(
  txs: UnifiedTx[],
  chainId: number,
): Promise<void> {
  if (txs.length === 0) return

  const db = getDb()
  const now = new Date()

  const values = txs.map((tx) => ({
    txHash: tx.hash,
    chainId,
    fromAddress: tx.from.toLowerCase(),
    toAddress: tx.to.toLowerCase(),
    value: tx.value,
    tokenSymbol: tx.tokenSymbol ?? null,
    tokenDecimal: tx.tokenDecimal != null ? Number(tx.tokenDecimal) : null,
    contractAddress: null as string | null,
    direction: tx.direction,
    blockNumber: null as number | null,
    timestamp: new Date(Number(tx.timeStamp) * 1000),
    isError: tx.isError !== '0',
    rawData: null,
    cachedAt: now,
  }))

  await db
    .insert(transactions)
    .values(values)
    .onConflictDoUpdate({
      target: [transactions.txHash, transactions.chainId, transactions.direction],
      set: {
        fromAddress: sql`excluded.from_address`,
        toAddress: sql`excluded.to_address`,
        value: sql`excluded.value`,
        tokenSymbol: sql`excluded.token_symbol`,
        tokenDecimal: sql`excluded.token_decimal`,
        timestamp: sql`excluded.timestamp`,
        isError: sql`excluded.is_error`,
        cachedAt: sql`excluded.cached_at`,
      },
    })
}

/**
 * Delete cached transaction rows older than 24 hours.
 */
export async function cleanupStaleTransactions(): Promise<void> {
  const db = getDb()
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS)

  await db
    .delete(transactions)
    .where(lt(transactions.cachedAt, cutoff))
}
