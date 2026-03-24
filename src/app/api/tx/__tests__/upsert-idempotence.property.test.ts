import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: database-integration, Property 7: Transaction cache upsert idempotence
 *
 * For any set of transactions, upserting the same transactions twice
 * (same tx_hash, chain_id, direction) should not create duplicate rows —
 * the unique constraint on (tx_hash, chain_id, direction) ensures at most
 * one row per combination.
 *
 * This tests the upsert logic at the application level, mirroring the
 * ON CONFLICT behaviour in tx-cache.ts without requiring a real database.
 *
 * **Validates: Requirements 1.5, 4.3**
 */

// --- Types (mirror tx-cache.ts / route.ts) ---

interface UnifiedTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  direction: 'in' | 'out';
}

interface StoredRow {
  txHash: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  value: string;
  tokenSymbol: string | null;
  tokenDecimal: number | null;
  direction: string;
  timestamp: Date;
  isError: boolean;
  cachedAt: Date;
}

// --- In-memory store simulating the DB unique constraint ---

/**
 * Simulates the `transactions` table with a unique constraint on
 * (tx_hash, chain_id, direction). Uses a Map keyed by the composite key.
 * ON CONFLICT → update existing row (mirrors Drizzle onConflictDoUpdate).
 */
class TxStore {
  private rows = new Map<string, StoredRow>();

  private key(txHash: string, chainId: number, direction: string): string {
    return `${txHash}|${chainId}|${direction}`;
  }

  upsert(txs: UnifiedTx[], chainId: number): void {
    const now = new Date();
    for (const tx of txs) {
      const k = this.key(tx.hash, chainId, tx.direction);
      // ON CONFLICT DO UPDATE — always overwrite with latest values
      this.rows.set(k, {
        txHash: tx.hash,
        chainId,
        fromAddress: tx.from.toLowerCase(),
        toAddress: tx.to.toLowerCase(),
        value: tx.value,
        tokenSymbol: tx.tokenSymbol ?? null,
        tokenDecimal: tx.tokenDecimal != null ? Number(tx.tokenDecimal) : null,
        direction: tx.direction,
        timestamp: new Date(Number(tx.timeStamp) * 1000),
        isError: tx.isError !== '0',
        cachedAt: now,
      });
    }
  }

  allRows(): StoredRow[] {
    return [...this.rows.values()];
  }

  size(): number {
    return this.rows.size;
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

const unifiedTxArb = fc.record({
  hash: txHashArb,
  from: addressArb,
  to: addressArb,
  value: fc.nat({ max: 1_000_000_000 }).map(String),
  timeStamp: fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }).map(String),
  isError: fc.constantFrom('0', '1'),
  direction: directionArb,
});

// --- Tests ---

describe('Feature: database-integration, Property 7: Transaction cache upsert idempotence', () => {
  /**
   * Upserting the same set of transactions twice should not create duplicates.
   * The row count after two upserts must equal the number of unique
   * (tx_hash, chain_id, direction) combinations in the input.
   *
   * **Validates: Requirements 1.5, 4.3**
   */
  it('double upsert produces no duplicate rows', () => {
    fc.assert(
      fc.property(
        fc.array(unifiedTxArb, { minLength: 1, maxLength: 20 }),
        chainIdArb,
        (txs, chainId) => {
          const store = new TxStore();

          // Upsert once
          store.upsert(txs, chainId);
          const countAfterFirst = store.size();

          // Upsert the exact same transactions again
          store.upsert(txs, chainId);
          const countAfterSecond = store.size();

          // Row count must not increase
          expect(countAfterSecond).toBe(countAfterFirst);

          // Count must equal unique (hash, chainId, direction) combos
          const uniqueKeys = new Set(
            txs.map((tx) => `${tx.hash}|${chainId}|${tx.direction}`),
          );
          expect(countAfterSecond).toBe(uniqueKeys.size);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * After double upsert, each stored row's data matches the last upserted
   * values (the second upsert overwrites the first, like ON CONFLICT DO UPDATE).
   *
   * **Validates: Requirements 1.5, 4.3**
   */
  it('second upsert overwrites values (ON CONFLICT DO UPDATE semantics)', () => {
    fc.assert(
      fc.property(
        fc.array(unifiedTxArb, { minLength: 1, maxLength: 15 }),
        chainIdArb,
        (txs, chainId) => {
          const store = new TxStore();

          // Mutate values slightly for the second upsert
          const modifiedTxs: UnifiedTx[] = txs.map((tx) => ({
            ...tx,
            value: String(Number(tx.value) + 1),
          }));

          store.upsert(txs, chainId);
          store.upsert(modifiedTxs, chainId);

          // Row count unchanged
          const uniqueKeys = new Set(
            txs.map((tx) => `${tx.hash}|${chainId}|${tx.direction}`),
          );
          expect(store.size()).toBe(uniqueKeys.size);

          // Values should reflect the second (modified) upsert
          const rows = store.allRows();
          for (const row of rows) {
            const matchingModified = modifiedTxs.find(
              (tx) =>
                tx.hash === row.txHash &&
                tx.direction === row.direction,
            );
            if (matchingModified) {
              expect(row.value).toBe(matchingModified.value);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Transactions with the same tx_hash but different directions ('in' vs 'out')
   * are stored as separate rows — the unique key includes direction.
   *
   * **Validates: Requirements 1.5, 4.3**
   */
  it('same tx_hash with different directions creates separate rows', () => {
    fc.assert(
      fc.property(txHashArb, addressArb, addressArb, chainIdArb, (hash, from, to, chainId) => {
        const store = new TxStore();

        const txIn: UnifiedTx = {
          hash,
          from,
          to,
          value: '1000',
          timeStamp: '1700000000',
          isError: '0',
          direction: 'in',
        };
        const txOut: UnifiedTx = { ...txIn, direction: 'out' };

        store.upsert([txIn, txOut], chainId);
        expect(store.size()).toBe(2);

        // Upsert again — still 2 rows
        store.upsert([txIn, txOut], chainId);
        expect(store.size()).toBe(2);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Transactions with the same tx_hash and direction but different chain IDs
   * are stored as separate rows — the unique key includes chain_id.
   *
   * **Validates: Requirements 1.5, 4.3**
   */
  it('same tx_hash with different chain IDs creates separate rows', () => {
    fc.assert(
      fc.property(txHashArb, addressArb, addressArb, (hash, from, to) => {
        const store = new TxStore();

        const tx: UnifiedTx = {
          hash,
          from,
          to,
          value: '2000',
          timeStamp: '1700000000',
          isError: '0',
          direction: 'in',
        };

        store.upsert([tx], 1);
        store.upsert([tx], 8453);
        expect(store.size()).toBe(2);

        // Upsert both again — still 2 rows
        store.upsert([tx], 1);
        store.upsert([tx], 8453);
        expect(store.size()).toBe(2);
      }),
      { numRuns: 200 },
    );
  });
});
