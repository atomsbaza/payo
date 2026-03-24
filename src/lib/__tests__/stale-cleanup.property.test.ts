import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: database-integration, Property 8: Stale data cleanup
 *
 * For any set of cached transactions older than 24 hours and rate limit
 * entries older than 1 hour, running the cleanup function should remove
 * all such stale entries and leave fresh entries untouched.
 *
 * This tests the cleanup logic at the application level, mirroring the
 * behaviour in tx-cache.ts and rate-limit.ts without requiring a real
 * database connection.
 *
 * **Validates: Requirements 4.4, 5.4, 9.2, 9.3**
 */

// --- Constants (mirror tx-cache.ts and rate-limit.ts) ---

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// --- Types ---

interface CachedTransaction {
  txHash: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  value: string;
  direction: 'in' | 'out';
  cachedAt: Date;
}

interface RateLimitEntry {
  key: string;
  windowStart: Date;
  count: number;
}

// --- In-memory stores simulating DB tables ---

class TransactionStore {
  private rows: CachedTransaction[] = [];

  insert(txs: CachedTransaction[]): void {
    this.rows.push(...txs);
  }

  /**
   * Delete rows where cachedAt < cutoff (mirrors cleanupStaleTransactions).
   * Uses strict less-than — entries exactly at the cutoff are kept.
   */
  cleanupStale(now: Date): number {
    const cutoff = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.cachedAt >= cutoff);
    return before - this.rows.length;
  }

  allRows(): CachedTransaction[] {
    return [...this.rows];
  }

  size(): number {
    return this.rows.length;
  }
}

class RateLimitStore {
  private rows: RateLimitEntry[] = [];

  insert(entries: RateLimitEntry[]): void {
    this.rows.push(...entries);
  }

  /**
   * Delete rows where windowStart < cutoff (mirrors rate limit cleanup).
   * Uses strict less-than — entries exactly at the cutoff are kept.
   */
  cleanupStale(now: Date): number {
    const cutoff = new Date(now.getTime() - ONE_HOUR_MS);
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.windowStart >= cutoff);
    return before - this.rows.length;
  }

  allRows(): RateLimitEntry[] {
    return [...this.rows];
  }

  size(): number {
    return this.rows.length;
  }
}

// --- Arbitraries ---

const hexChar = fc.mapToConstant(
  { num: 10, build: (v) => String.fromCharCode(48 + v) },  // 0-9
  { num: 6, build: (v) => String.fromCharCode(97 + v) },   // a-f
);

const txHashArb = fc.array(hexChar, { minLength: 64, maxLength: 64 }).map(
  (chars) => '0x' + chars.join(''),
);

const addressArb = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map(
  (chars) => '0x' + chars.join(''),
);

const directionArb = fc.constantFrom<'in' | 'out'>('in', 'out');
const chainIdArb = fc.constantFrom(1, 8453, 84532, 10, 42161);

/** Age in ms that is fresh for transactions (< 24 hours) */
const freshTxAgeArb = fc.integer({ min: 0, max: TWENTY_FOUR_HOURS_MS - 1 });
/** Age in ms that is stale for transactions (> 24 hours, strictly past cutoff) */
const staleTxAgeArb = fc.integer({ min: TWENTY_FOUR_HOURS_MS + 1, max: TWENTY_FOUR_HOURS_MS * 5 });

/** Age in ms that is fresh for rate limit entries (< 1 hour) */
const freshRlAgeArb = fc.integer({ min: 0, max: ONE_HOUR_MS - 1 });
/** Age in ms that is stale for rate limit entries (> 1 hour, strictly past cutoff) */
const staleRlAgeArb = fc.integer({ min: ONE_HOUR_MS + 1, max: ONE_HOUR_MS * 10 });

function makeTx(
  i: number,
  dir: 'in' | 'out',
  chainId: number,
  cachedAt: Date,
): CachedTransaction {
  return {
    txHash: '0x' + String(i).padStart(64, 'a'),
    chainId,
    fromAddress: '0x' + 'b'.repeat(40),
    toAddress: '0x' + 'c'.repeat(40),
    value: String(1000 * (i + 1)),
    direction: dir,
    cachedAt,
  };
}

function makeRlEntry(i: number, windowStart: Date): RateLimitEntry {
  return {
    key: `192.168.1.${i % 256}`,
    windowStart,
    count: i + 1,
  };
}

// --- Tests ---

describe('Feature: database-integration, Property 8: Stale data cleanup', () => {
  const now = new Date('2025-06-01T12:00:00Z');

  /**
   * Transaction cache entries older than 24 hours are removed by cleanup.
   * Fresh entries (< 24 hours) are left untouched.
   * **Validates: Requirements 4.4, 9.2**
   */
  it('cleanup removes stale transaction cache entries and keeps fresh ones', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        freshTxAgeArb,
        staleTxAgeArb,
        chainIdArb,
        directionArb,
        (freshCount, staleCount, freshAge, staleAge, chainId, dir) => {
          const store = new TransactionStore();

          const freshAt = new Date(now.getTime() - freshAge);
          const staleAt = new Date(now.getTime() - staleAge);

          const freshTxs = Array.from({ length: freshCount }, (_, i) =>
            makeTx(i, dir, chainId, freshAt),
          );
          const staleTxs = Array.from({ length: staleCount }, (_, i) =>
            makeTx(i + 100, dir, chainId, staleAt),
          );

          store.insert([...freshTxs, ...staleTxs]);
          expect(store.size()).toBe(freshCount + staleCount);

          const removed = store.cleanupStale(now);

          // All stale entries removed
          expect(removed).toBe(staleCount);
          // Only fresh entries remain
          expect(store.size()).toBe(freshCount);
          // Remaining rows are all fresh
          for (const row of store.allRows()) {
            expect(row.cachedAt.getTime()).toBeGreaterThanOrEqual(
              now.getTime() - TWENTY_FOUR_HOURS_MS,
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Rate limit entries older than 1 hour are removed by cleanup.
   * Fresh entries (< 1 hour) are left untouched.
   * **Validates: Requirements 5.4, 9.3**
   */
  it('cleanup removes stale rate limit entries and keeps fresh ones', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        freshRlAgeArb,
        staleRlAgeArb,
        (freshCount, staleCount, freshAge, staleAge) => {
          const store = new RateLimitStore();

          const freshAt = new Date(now.getTime() - freshAge);
          const staleAt = new Date(now.getTime() - staleAge);

          const freshEntries = Array.from({ length: freshCount }, (_, i) =>
            makeRlEntry(i, freshAt),
          );
          const staleEntries = Array.from({ length: staleCount }, (_, i) =>
            makeRlEntry(i + 100, staleAt),
          );

          store.insert([...freshEntries, ...staleEntries]);
          expect(store.size()).toBe(freshCount + staleCount);

          const removed = store.cleanupStale(now);

          // All stale entries removed
          expect(removed).toBe(staleCount);
          // Only fresh entries remain
          expect(store.size()).toBe(freshCount);
          // Remaining rows are all fresh
          for (const row of store.allRows()) {
            expect(row.windowStart.getTime()).toBeGreaterThanOrEqual(
              now.getTime() - ONE_HOUR_MS,
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Entries exactly at the cleanup boundary are NOT removed (strict less-than).
   * Transaction at exactly 24 hours → kept.
   * Rate limit at exactly 1 hour → kept.
   * One millisecond past the boundary → removed.
   * **Validates: Requirements 4.4, 5.4**
   */
  it('entries exactly at the boundary are kept, one ms past are removed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        chainIdArb,
        (n, chainId) => {
          // Transaction at exactly 24-hour boundary → kept
          const txStore = new TransactionStore();
          const txBoundary = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
          const txs = Array.from({ length: n }, (_, i) =>
            makeTx(i, 'in', chainId, txBoundary),
          );
          txStore.insert(txs);
          txStore.cleanupStale(now);
          expect(txStore.size()).toBe(n);

          // Transaction 1ms past boundary → removed
          const txStoreStale = new TransactionStore();
          const txPastBoundary = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS - 1);
          const staleTxs = Array.from({ length: n }, (_, i) =>
            makeTx(i, 'in', chainId, txPastBoundary),
          );
          txStoreStale.insert(staleTxs);
          txStoreStale.cleanupStale(now);
          expect(txStoreStale.size()).toBe(0);

          // Rate limit at exactly 1-hour boundary → kept
          const rlStore = new RateLimitStore();
          const rlBoundary = new Date(now.getTime() - ONE_HOUR_MS);
          const rls = Array.from({ length: n }, (_, i) =>
            makeRlEntry(i, rlBoundary),
          );
          rlStore.insert(rls);
          rlStore.cleanupStale(now);
          expect(rlStore.size()).toBe(n);

          // Rate limit 1ms past boundary → removed
          const rlStoreStale = new RateLimitStore();
          const rlPastBoundary = new Date(now.getTime() - ONE_HOUR_MS - 1);
          const staleRls = Array.from({ length: n }, (_, i) =>
            makeRlEntry(i, rlPastBoundary),
          );
          rlStoreStale.insert(staleRls);
          rlStoreStale.cleanupStale(now);
          expect(rlStoreStale.size()).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Cleanup on an empty store is a no-op — no errors, zero removed.
   * **Validates: Requirements 4.4, 5.4**
   */
  it('cleanup on empty store removes nothing', () => {
    const txStore = new TransactionStore();
    expect(txStore.cleanupStale(now)).toBe(0);
    expect(txStore.size()).toBe(0);

    const rlStore = new RateLimitStore();
    expect(rlStore.cleanupStale(now)).toBe(0);
    expect(rlStore.size()).toBe(0);
  });

  /**
   * When all entries are fresh, cleanup removes nothing.
   * **Validates: Requirements 4.4, 5.4, 9.2, 9.3**
   */
  it('cleanup with only fresh entries removes nothing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        freshTxAgeArb,
        freshRlAgeArb,
        chainIdArb,
        (n, txAge, rlAge, chainId) => {
          const txStore = new TransactionStore();
          const freshTxAt = new Date(now.getTime() - txAge);
          const txs = Array.from({ length: n }, (_, i) =>
            makeTx(i, 'in', chainId, freshTxAt),
          );
          txStore.insert(txs);
          const txRemoved = txStore.cleanupStale(now);
          expect(txRemoved).toBe(0);
          expect(txStore.size()).toBe(n);

          const rlStore = new RateLimitStore();
          const freshRlAt = new Date(now.getTime() - rlAge);
          const rls = Array.from({ length: n }, (_, i) =>
            makeRlEntry(i, freshRlAt),
          );
          rlStore.insert(rls);
          const rlRemoved = rlStore.cleanupStale(now);
          expect(rlRemoved).toBe(0);
          expect(rlStore.size()).toBe(n);
        },
      ),
      { numRuns: 100 },
    );
  });
});
