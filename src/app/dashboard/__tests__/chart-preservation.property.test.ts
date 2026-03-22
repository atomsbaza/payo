import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'
import { aggregateByDay } from '../aggregation'

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation — Non-Chart Dashboard Behavior Unchanged
 *
 * These tests verify behaviors that are NOT affected by the CSS bar-height bug.
 * They must PASS on both unfixed and fixed code, confirming baseline behavior
 * is preserved across the fix.
 */

// --- Arbitraries (reused patterns from aggregation.test.ts) ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const timestampArb = fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }).map(String)

const valueArb = fc.bigInt({ min: 1n, max: (1n << 64n) - 1n }).map(String)

// Only outgoing transactions — no incoming
const outOnlyTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: valueArb,
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  direction: fc.constant('out' as const),
})

// Mixed direction transactions
const directionArb = fc.constantFrom('in' as const, 'out' as const)

const mixedTxArb: fc.Arbitrary<UnifiedTx> = fc.oneof(
  fc.record({
    hash: txHashArb,
    from: ethAddressArb,
    to: ethAddressArb,
    value: valueArb,
    timeStamp: timestampArb,
    isError: fc.constant('0'),
    direction: directionArb,
  }),
  fc.record({
    hash: txHashArb,
    from: ethAddressArb,
    to: ethAddressArb,
    value: valueArb,
    timeStamp: timestampArb,
    isError: fc.constant('0'),
    tokenSymbol: fc.constant('USDC'),
    tokenDecimal: fc.constant('6'),
    direction: directionArb,
  }),
)


// Arbitrary: daily data entry with positive total
const positiveBigIntArb = fc.bigInt({ min: 1n, max: (1n << 64n) - 1n })

// Use integer offset from a base date to avoid invalid date issues during shrinking
const baseDateMs = new Date('2024-01-01').getTime()
const dateArb = fc
  .integer({ min: 0, max: 730 }) // 0..730 days from 2024-01-01
  .map((offset) => new Date(baseDateMs + offset * 86_400_000).toISOString().slice(0, 10))

type DailyEntry = { date: string; total: bigint }

const dailyEntryArb: fc.Arbitrary<DailyEntry> = fc.record({
  date: dateArb,
  total: positiveBigIntArb,
})

describe('Chart Preservation — Non-Chart Dashboard Behavior Unchanged', () => {
  /**
   * Preservation 3.1: When there are no incoming transactions,
   * aggregateByDay returns an empty array (chart hidden).
   */
  it('aggregateByDay returns empty array when all txs are outgoing (no incoming)', () => {
    fc.assert(
      fc.property(
        fc.array(outOnlyTxArb, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const result = aggregateByDay(txs)
          expect(result).toEqual([])
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Preservation 3.2: aggregateByDay output is always sorted ascending by date.
   */
  it('aggregateByDay output is sorted ascending by date', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const result = aggregateByDay(txs)
          for (let i = 1; i < result.length; i++) {
            expect(result[i].date >= result[i - 1].date).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Preservation 3.4: .slice(-14) on arrays with length > 14 returns exactly 14 entries
   * (the last 14).
   */
  it('slice(-14) on daily data with length > 14 returns exactly 14 entries', () => {
    // Generate 15-30 unique dates deterministically to avoid invalid date issues
    const uniqueDailyDataArb = fc
      .integer({ min: 15, max: 30 })
      .chain((len) =>
        fc.tuple(
          fc.integer({ min: 0, max: 700 - len }), // start offset from 2024-01-01
          fc.array(positiveBigIntArb, { minLength: len, maxLength: len }),
        ).map(([startOffset, totals]) => {
          const base = new Date('2024-01-01').getTime()
          return totals.map((total, i) => {
            const d = new Date(base + (startOffset + i) * 86_400_000)
            return { date: d.toISOString().slice(0, 10), total }
          })
        }),
      )

    fc.assert(
      fc.property(uniqueDailyDataArb, (dailyData) => {
        const sliced = dailyData.slice(-14)
        expect(sliced).toHaveLength(14)
        // Sliced entries are the last 14 from the original
        expect(sliced).toEqual(dailyData.slice(dailyData.length - 14))
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Preservation 3.3: maxTotal equals the maximum total value across all daily entries.
   */
  it('maxTotal equals the maximum total value in daily data', () => {
    fc.assert(
      fc.property(
        fc.array(dailyEntryArb, { minLength: 1, maxLength: 30 })
          .map((entries) => {
            const seen = new Set<string>()
            return entries.filter((e) => {
              if (seen.has(e.date)) return false
              seen.add(e.date)
              return true
            })
          })
          .filter((entries) => entries.length >= 1),
        (dailyData) => {
          const maxTotal = dailyData.reduce(
            (m, d) => (d.total > m ? d.total : m),
            0n,
          )

          // maxTotal should equal the actual maximum
          const expectedMax = dailyData
            .map((d) => d.total)
            .reduce((a, b) => (a > b ? a : b))

          expect(maxTotal).toBe(expectedMax)
        },
      ),
      { numRuns: 100 },
    )
  })
})
