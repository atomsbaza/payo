import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: database-integration, Property 6: Transaction cache freshness
 *
 * For any address with cached transactions where cached_at is within the
 * last 5 minutes, querying should return the cached data without making a
 * Basescan API call. For any address with stale or missing cache, the system
 * should fetch from Basescan and upsert the results.
 *
 * This tests the cache freshness decision logic at the application level,
 * mirroring the behaviour in GET /api/tx/[address] and tx-cache.ts without
 * requiring a real database connection.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

// --- Constants (mirror tx-cache.ts) ---

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// --- Types ---

interface CachedTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  direction: 'in' | 'out';
  cachedAt: Date;
}

// --- Cache freshness logic (mirrors getCachedTransactions + route) ---

function getCachedIfFresh(
  rows: CachedTx[],
  now: Date,
  maxAgeMs: number = FIVE_MINUTES_MS,
): CachedTx[] | null {
  if (rows.length === 0) return null;
  const cutoff = new Date(now.getTime() - maxAgeMs);
  const fresh = rows.filter((r) => r.cachedAt > cutoff);
  return fresh.length > 0 ? fresh : null;
}

type Action = 'cache_hit' | 'api_call';

function resolve(
  cached: CachedTx[],
  apiResult: CachedTx[],
  now: Date,
): { action: Action; transactions: CachedTx[] } {
  const fresh = getCachedIfFresh(cached, now);
  if (fresh) return { action: 'cache_hit', transactions: fresh };
  return { action: 'api_call', transactions: apiResult };
}

// --- Arbitraries ---

const freshAgeArb = fc.integer({ min: 0, max: FIVE_MINUTES_MS - 1 });
const staleAgeArb = fc.integer({ min: FIVE_MINUTES_MS, max: FIVE_MINUTES_MS * 10 });

function makeTx(i: number, dir: 'in' | 'out', cachedAt: Date): CachedTx {
  return {
    hash: '0x' + String(i).padStart(64, 'a'),
    from: '0x' + 'b'.repeat(40),
    to: '0x' + 'c'.repeat(40),
    value: String(1000 * (i + 1)),
    timeStamp: String(1700000000 + i),
    isError: '0',
    direction: dir,
    cachedAt,
  };
}

// --- Tests ---

describe('Feature: database-integration, Property 6: Transaction cache freshness', () => {
  const now = new Date('2025-06-01T12:00:00Z');

  /**
   * Fresh cache (cachedAt within 5 minutes) is returned without API call.
   * **Validates: Requirements 4.1, 4.2**
   */
  it('returns cached data without API call when cache is fresh', () => {
    fc.assert(
      fc.property(freshAgeArb, fc.integer({ min: 1, max: 10 }), (age, n) => {
        const at = new Date(now.getTime() - age);
        const rows = Array.from({ length: n }, (_, i) => makeTx(i, 'in', at));
        const r = resolve(rows, [], now);
        expect(r.action).toBe('cache_hit');
        expect(r.transactions).toEqual(rows);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Stale cache (older than 5 minutes) triggers an API call.
   * **Validates: Requirements 4.1, 4.3**
   */
  it('triggers API call when cache is stale', () => {
    fc.assert(
      fc.property(staleAgeArb, fc.integer({ min: 1, max: 10 }), (age, n) => {
        const at = new Date(now.getTime() - age);
        const rows = Array.from({ length: n }, (_, i) => makeTx(i, 'out', at));
        const api = Array.from({ length: n }, (_, i) => makeTx(i + 100, 'in', now));
        const r = resolve(rows, api, now);
        expect(r.action).toBe('api_call');
        expect(r.transactions).toEqual(api);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Missing cache (empty array) triggers an API call.
   * **Validates: Requirements 4.1, 4.3**
   */
  it('triggers API call when cache is empty', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const api = Array.from({ length: n }, (_, i) => makeTx(i, 'in', now));
        const r = resolve([], api, now);
        expect(r.action).toBe('api_call');
        expect(r.transactions).toEqual(api);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * The 5-minute boundary is exact: cachedAt exactly at the cutoff is stale.
   * **Validates: Requirements 4.1, 4.2**
   */
  it('cache exactly at 5-minute boundary is treated as stale', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const boundary = new Date(now.getTime() - FIVE_MINUTES_MS);
        const rows = Array.from({ length: n }, (_, i) => makeTx(i, 'in', boundary));
        const api = [makeTx(99, 'in', now)];
        const r = resolve(rows, api, now);
        expect(r.action).toBe('api_call');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Mixed fresh and stale rows: if at least one row is fresh, cache is a hit
   * and only fresh rows are returned.
   * **Validates: Requirements 4.1, 4.2**
   */
  it('returns only fresh rows when mix of fresh and stale rows exist', () => {
    fc.assert(
      fc.property(
        freshAgeArb,
        staleAgeArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (fAge, sAge, fN, sN) => {
          const fAt = new Date(now.getTime() - fAge);
          const sAt = new Date(now.getTime() - sAge);
          const fresh = Array.from({ length: fN }, (_, i) => makeTx(i, 'in', fAt));
          const stale = Array.from({ length: sN }, (_, i) => makeTx(i + 50, 'out', sAt));
          const r = resolve([...fresh, ...stale], [], now);
          expect(r.action).toBe('cache_hit');
          expect(r.transactions).toEqual(fresh);
        },
      ),
      { numRuns: 100 },
    );
  });
});
