import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'
import type { SavedLink } from '@/lib/validate-storage'
import {
  aggregateTotals,
  filterTransactions,
  getLinkStatus,
  aggregateSentTotals,
  aggregateByDay,
  buildCsvContent,
  matchTxToLink,
} from '../aggregation'
import type { TxFilter } from '../aggregation'

// Arbitrary: valid hex hash
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: valid Ethereum address
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// Arbitrary: unix timestamp as string
const timestampArb = fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }).map(String)

// Arbitrary: positive bigint value as string (avoid 0 for meaningful sums)
const valueArb = fc.bigInt({ min: 1n, max: (1n << 64n) - 1n }).map(String)

const directionArb = fc.constantFrom('in' as const, 'out' as const)

// Arbitrary: ETH transaction
const ethTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: valueArb,
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  direction: directionArb,
})

// Arbitrary: USDC (ERC-20) transaction
const usdcTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: valueArb,
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  tokenSymbol: fc.constant('USDC'),
  tokenDecimal: fc.constant('6'),
  direction: directionArb,
})

// Arbitrary: mixed transaction (either ETH or USDC)
const mixedTxArb: fc.Arbitrary<UnifiedTx> = fc.oneof(ethTxArb, usdcTxArb)

describe('aggregateTotals', () => {
  /**
   * Property: Total received aggregation only counts incoming transactions.
   * ETH total equals sum of ETH-only incoming txs, USDC total equals sum of USDC-only incoming txs.
   */
  it('only aggregates incoming transactions, ignoring outgoing', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 1, maxLength: 30 }),
        (txs) => {
          const totals = aggregateTotals(txs)

          // Manually compute expected totals (only 'in' direction)
          let expectedEth = 0n
          let expectedUsdc = 0n
          for (const tx of txs) {
            if (tx.direction !== 'in') continue
            const val = BigInt(tx.value)
            if (tx.tokenSymbol === 'USDC') {
              expectedUsdc += val
            } else {
              expectedEth += val
            }
          }

          if (expectedEth > 0n) {
            expect(totals['ETH']).toBe(expectedEth)
          } else {
            expect(totals['ETH']).toBeUndefined()
          }

          if (expectedUsdc > 0n) {
            expect(totals['USDC']).toBe(expectedUsdc)
          } else {
            expect(totals['USDC']).toBeUndefined()
          }

          const tokenKeys = Object.keys(totals)
          for (const key of tokenKeys) {
            expect(['ETH', 'USDC']).toContain(key)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Additional arbitraries for new property tests ---

const tokenSymbolArb = fc.constantFrom('ETH', 'USDC', 'USDT')

// Arbitrary: generic ERC-20 transaction with variable token
const tokenTxArb: fc.Arbitrary<UnifiedTx> = fc.record({
  hash: txHashArb,
  from: ethAddressArb,
  to: ethAddressArb,
  value: valueArb,
  timeStamp: timestampArb,
  isError: fc.constant('0'),
  tokenSymbol: tokenSymbolArb,
  tokenDecimal: fc.constant('18'),
  direction: directionArb,
})

// Arbitrary: TxFilter
const txFilterArb: fc.Arbitrary<TxFilter> = fc.record({
  token: fc.option(tokenSymbolArb, { nil: null }),
  direction: fc.option(fc.constantFrom('in' as const, 'out' as const), { nil: null }),
  startDate: fc.option(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { nil: null }),
  endDate: fc.option(fc.integer({ min: 1_600_000_000, max: 1_800_000_000 }), { nil: null }),
})

// Arbitrary: SavedLink
const savedLinkArb: fc.Arbitrary<SavedLink> = fc.record({
  url: fc.webUrl(),
  address: ethAddressArb,
  token: tokenSymbolArb,
  amount: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map((n) => n.toFixed(2)),
  memo: fc.string({ minLength: 0, maxLength: 20 }),
  createdAt: fc.integer({ min: 1_600_000_000_000, max: 1_800_000_000_000 }),
})

/**
 * Feature: dashboard-enhancements, Property 2: Filter applies all criteria simultaneously
 * Validates: Requirement 2.5
 */
describe('filterTransactions', () => {
  it('applies all filter criteria simultaneously — every result satisfies all active criteria and no valid tx is excluded', () => {
    fc.assert(
      fc.property(
        fc.array(tokenTxArb, { minLength: 0, maxLength: 30 }),
        txFilterArb,
        (txs, filter) => {
          const result = filterTransactions(txs, filter)

          // Every returned tx must satisfy ALL active criteria
          for (const tx of result) {
            const txToken = tx.tokenSymbol ?? 'ETH'
            if (filter.token) {
              expect(txToken).toBe(filter.token)
            }
            if (filter.direction) {
              expect(tx.direction).toBe(filter.direction)
            }
            const ts = Number(tx.timeStamp)
            if (filter.startDate) {
              expect(ts).toBeGreaterThanOrEqual(filter.startDate)
            }
            if (filter.endDate) {
              expect(ts).toBeLessThanOrEqual(filter.endDate)
            }
          }

          // No valid tx should be excluded — manually check each input tx
          for (const tx of txs) {
            const txToken = tx.tokenSymbol ?? 'ETH'
            const ts = Number(tx.timeStamp)
            const matchesToken = !filter.token || txToken === filter.token
            const matchesDir = !filter.direction || tx.direction === filter.direction
            const matchesStart = !filter.startDate || ts >= filter.startDate
            const matchesEnd = !filter.endDate || ts <= filter.endDate
            const shouldBeIncluded = matchesToken && matchesDir && matchesStart && matchesEnd

            if (shouldBeIncluded) {
              expect(result).toContain(tx)
            } else {
              expect(result).not.toContain(tx)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: dashboard-enhancements, Property 3: Link status correctness
 * Validates: Requirements 3.2, 3.3, 3.5
 */
describe('getLinkStatus', () => {
  it('returns active iff expiryDate is undefined or now < expiryDate, expired otherwise', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), { nil: undefined }),
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        (expiryDate, now) => {
          const status = getLinkStatus(expiryDate, now)

          if (expiryDate === undefined || now < expiryDate) {
            expect(status).toBe('active')
          } else {
            expect(status).toBe('expired')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: dashboard-enhancements, Property 4: Sent totals aggregation only counts outgoing
 * Validates: Requirements 4.1, 4.2
 */
describe('aggregateSentTotals', () => {
  it('sums only direction === out txs per token, never counts incoming', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const totals = aggregateSentTotals(txs)

          // Manually compute expected sent totals
          const expected: Record<string, bigint> = {}
          for (const tx of txs) {
            if (tx.direction !== 'out') continue
            const token = tx.tokenSymbol ?? 'ETH'
            const value = BigInt(tx.value)
            expected[token] = (expected[token] ?? 0n) + value
          }

          // Check every token in result matches expected
          for (const [token, total] of Object.entries(totals)) {
            expect(total).toBe(expected[token])
          }

          // Check no expected token is missing
          for (const [token, total] of Object.entries(expected)) {
            expect(totals[token]).toBe(total)
          }

          // Verify incoming txs are never counted
          const incomingTokens = new Set(
            txs.filter((tx) => tx.direction === 'in').map((tx) => tx.tokenSymbol ?? 'ETH')
          )
          for (const token of incomingTokens) {
            if (!expected[token]) {
              expect(totals[token]).toBeUndefined()
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: dashboard-enhancements, Property 5: Daily aggregation groups incoming by calendar date
 * Validates: Requirements 5.1, 5.2, 5.8
 */
describe('aggregateByDay', () => {
  it('groups and sums incoming txs by calendar date, sorted ascending, excludes outgoing', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const result = aggregateByDay(txs)

          // Manually compute expected daily totals for incoming only
          const expected: Record<string, bigint> = {}
          for (const tx of txs) {
            if (tx.direction !== 'in') continue
            const d = new Date(Number(tx.timeStamp) * 1000)
            const key = d.toISOString().slice(0, 10)
            const value = BigInt(tx.value)
            expected[key] = (expected[key] ?? 0n) + value
          }

          // Result should have same number of date entries
          expect(result.length).toBe(Object.keys(expected).length)

          // Each entry should match expected total
          for (const entry of result) {
            expect(expected[entry.date]).toBe(entry.total)
          }

          // Result should be sorted ascending by date
          for (let i = 1; i < result.length; i++) {
            expect(result[i].date >= result[i - 1].date).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: dashboard-enhancements, Property 6: CSV content format correctness
 * Validates: Requirements 7.3, 7.4, 7.5
 */
describe('buildCsvContent — format', () => {
  it('produces correct header, 7 fields per row, ISO 8601 date, valid decimal amount', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 1, maxLength: 20 }),
        (txs) => {
          const csv = buildCsvContent(txs)
          const lines = csv.split('\n')

          // First line is the header
          expect(lines[0]).toBe('Date,Direction,Amount,Token,From,To,TX Hash')

          // Each data row has exactly 7 comma-separated fields
          for (let i = 1; i < lines.length; i++) {
            const fields = lines[i].split(',')
            expect(fields.length).toBe(7)

            // Date field matches ISO 8601 format YYYY-MM-DDTHH:mm:ss
            expect(fields[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)

            // Amount field is a valid decimal number
            expect(Number.isFinite(parseFloat(fields[2]))).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: dashboard-enhancements, Property 7: CSV round-trip row count
 * Validates: Requirement 7.8
 */
describe('buildCsvContent — row count', () => {
  it('split(newline).length === input.length + 1 (header + N data rows)', () => {
    fc.assert(
      fc.property(
        fc.array(mixedTxArb, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const csv = buildCsvContent(txs)
          const lines = csv.split('\n')
          expect(lines.length).toBe(txs.length + 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: dashboard-enhancements, Property 8: TX-to-Link matching correctness
 * Validates: Requirements 8.2, 8.7
 */
describe('matchTxToLink', () => {
  it('returns null when no match, or the earliest tx satisfying all criteria', () => {
    fc.assert(
      fc.property(
        savedLinkArb,
        fc.array(tokenTxArb, { minLength: 0, maxLength: 20 }),
        (link, txs) => {
          const result = matchTxToLink(link, txs)

          // Compute expected candidates manually
          const candidates = txs.filter((tx) => {
            if (tx.direction !== 'in') return false
            if (Number(tx.timeStamp) < link.createdAt / 1000) return false
            const txToken = tx.tokenSymbol ?? 'ETH'
            if (txToken !== link.token) return false
            return true
          })

          if (candidates.length === 0) {
            expect(result).toBeNull()
          } else {
            expect(result).not.toBeNull()

            // Result must satisfy all criteria
            expect(result!.direction).toBe('in')
            expect(Number(result!.timeStamp)).toBeGreaterThanOrEqual(link.createdAt / 1000)
            const resultToken = result!.tokenSymbol ?? 'ETH'
            expect(resultToken).toBe(link.token)

            // Result must be the earliest matching tx
            const earliest = candidates.reduce((e, tx) =>
              Number(tx.timeStamp) < Number(e.timeStamp) ? tx : e
            )
            expect(Number(result!.timeStamp)).toBe(Number(earliest.timeStamp))
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
