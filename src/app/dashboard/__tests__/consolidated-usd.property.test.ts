import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatUnits } from 'viem'
import { computeConsolidatedUsd, formatUsdValue, type TokenTotal, type PriceMap } from '../aggregation'

/**
 * Feature: dashboard-usd-total, Property 1: Consolidated USD sum equals manual per-token sum
 *
 * For any list of TokenTotal entries and for any PriceMap where at least one
 * token has a non-null price, computeConsolidatedUsd(tokenTotals, prices).total
 * should equal the sum of parseFloat(formatUnits(t.rawTotal, t.decimals)) * prices[t.token]
 * for each token t where prices[t.token] is not null.
 *
 * **Validates: Requirements 1.1, 1.2, 3.1**
 */

// --- Arbitraries ---

const tokenNameArb = fc.constantFrom('ETH', 'USDC', 'USDT', 'DAI', 'cbBTC')

const decimalsArb = fc.constantFrom(6, 8, 18)

const tokenTotalArb: fc.Arbitrary<TokenTotal> = fc.record({
  token: tokenNameArb,
  rawTotal: fc.bigInt({ min: 0n, max: 10n ** 30n }),
  decimals: decimalsArb,
})

/** Generate 1–5 TokenTotal entries with unique token names */
const tokenTotalsArb: fc.Arbitrary<TokenTotal[]> = fc
  .uniqueArray(tokenTotalArb, { minLength: 1, maxLength: 5, selector: (t) => t.token })

/**
 * Generate a PriceMap for the given tokens.
 * Mix of positive numbers and nulls, with at least one non-null price.
 */
function priceMapArb(tokens: string[]): fc.Arbitrary<PriceMap> {
  if (tokens.length === 0) return fc.constant({})

  const priceEntryArb = fc.oneof(
    { weight: 3, arbitrary: fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }) },
    { weight: 1, arbitrary: fc.constant(null as number | null) },
  )

  return fc
    .tuple(...tokens.map(() => priceEntryArb))
    .filter((prices) => prices.some((p) => p !== null))
    .map((prices) => {
      const map: PriceMap = {}
      tokens.forEach((token, i) => {
        map[token] = prices[i]
      })
      return map
    })
}

// --- Manual reference calculation ---

function manualSum(totals: TokenTotal[], prices: PriceMap): number {
  let sum = 0
  for (const { token, rawTotal, decimals } of totals) {
    const price = prices[token] ?? null
    if (price === null) continue
    const formatted = parseFloat(formatUnits(rawTotal, decimals))
    sum += formatted * price
  }
  return sum
}

// --- Tests ---

describe("Feature: dashboard-usd-total, Property 1: Consolidated USD sum equals manual per-token sum", () => {
  /**
   * The consolidated total returned by computeConsolidatedUsd must equal
   * the manually computed per-token sum within floating-point tolerance.
   * **Validates: Requirements 1.1, 1.2, 3.1**
   */
  it('computeConsolidatedUsd total ≈ manual per-token sum', () => {
    fc.assert(
      fc.property(
        tokenTotalsArb.chain((totals) => {
          const tokens = totals.map((t) => t.token)
          return priceMapArb(tokens).map((prices) => ({ totals, prices }))
        }),
        ({ totals, prices }) => {
          const result = computeConsolidatedUsd(totals, prices)
          const expected = manualSum(totals, prices)

          // Use relative tolerance for large values, absolute for small
          const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-9)
          expect(result.total).toBeCloseTo(expected, -Math.log10(tolerance))
        },
      ),
      { numRuns: 100 },
    )
  })
})


/**
 * Feature: dashboard-usd-total, Property 2: Null-price tokens are excluded and reported
 *
 * For any list of TokenTotal entries and for any PriceMap (including all-null),
 * the excludedTokens array returned by computeConsolidatedUsd should contain
 * exactly the tokens whose price is null in the PriceMap, and the total should
 * not include any contribution from those tokens. When all prices are null,
 * hasAnyPrice should be false.
 *
 * **Validates: Requirements 1.3, 5.1, 5.2**
 */

/**
 * Generate a PriceMap that allows ALL nulls (unlike priceMapArb which requires at least one non-null).
 */
function priceMapWithNullsArb(tokens: string[]): fc.Arbitrary<PriceMap> {
  if (tokens.length === 0) return fc.constant({})

  const priceEntryArb = fc.oneof(
    { weight: 2, arbitrary: fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }) },
    { weight: 2, arbitrary: fc.constant(null as number | null) },
  )

  return fc
    .tuple(...tokens.map(() => priceEntryArb))
    .map((prices) => {
      const map: PriceMap = {}
      tokens.forEach((token, i) => {
        map[token] = prices[i]
      })
      return map
    })
}

describe('Feature: dashboard-usd-total, Property 2: Null-price tokens are excluded and reported', () => {
  /**
   * excludedTokens must contain exactly the tokens with null prices.
   * hasAnyPrice must be true iff at least one token has a non-null price.
   * **Validates: Requirements 1.3, 5.1, 5.2**
   */
  it('excludedTokens matches exactly the null-price tokens and hasAnyPrice is correct', () => {
    fc.assert(
      fc.property(
        tokenTotalsArb.chain((totals) => {
          const tokens = totals.map((t) => t.token)
          return priceMapWithNullsArb(tokens).map((prices) => ({ totals, prices }))
        }),
        ({ totals, prices }) => {
          const result = computeConsolidatedUsd(totals, prices)

          // Determine which tokens should be excluded (null price)
          const expectedExcluded = totals
            .filter((t) => prices[t.token] === null)
            .map((t) => t.token)

          // excludedTokens must match exactly the null-price tokens
          expect(result.excludedTokens).toEqual(expectedExcluded)

          // hasAnyPrice must be true iff there are fewer excluded tokens than total tokens
          expect(result.hasAnyPrice).toBe(result.excludedTokens.length < totals.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Edge case: when ALL prices are null, hasAnyPrice must be false and total must be 0.
   * **Validates: Requirements 1.3, 5.1, 5.2**
   */
  it('all-null prices → hasAnyPrice === false and total === 0', () => {
    fc.assert(
      fc.property(
        tokenTotalsArb,
        (totals) => {
          // Build a PriceMap where every token has null price
          const allNullPrices: PriceMap = {}
          for (const t of totals) {
            allNullPrices[t.token] = null
          }

          const result = computeConsolidatedUsd(totals, allNullPrices)

          expect(result.hasAnyPrice).toBe(false)
          expect(result.total).toBe(0)
          expect(result.excludedTokens.length).toBe(totals.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})


/**
 * Feature: dashboard-usd-total, Property 3: USD formatting matches Intl.NumberFormat for all locales
 *
 * For any non-negative finite number and for any supported locale (th-TH or en-US),
 * formatUsdValue(amount, locale) should produce the same string as
 * new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount).
 *
 * **Validates: Requirements 1.4, 6.1, 6.2, 6.3**
 */

describe('Feature: dashboard-usd-total, Property 3: USD formatting matches Intl.NumberFormat for all locales', () => {
  const localeArb = fc.constantFrom<'th-TH' | 'en-US'>('th-TH', 'en-US')
  const nonNegativeFiniteArb = fc.double({ min: 0, noNaN: true, noDefaultInfinity: true })

  /**
   * formatUsdValue must produce the exact same string as Intl.NumberFormat
   * for any non-negative finite amount and any supported locale.
   * **Validates: Requirements 1.4, 6.1, 6.2, 6.3**
   */
  it('formatUsdValue(amount, locale) === Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(amount)', () => {
    fc.assert(
      fc.property(
        nonNegativeFiniteArb,
        localeArb,
        (amount, locale) => {
          const actual = formatUsdValue(amount, locale)
          const expected = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'USD',
          }).format(amount)

          expect(actual).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })
})
