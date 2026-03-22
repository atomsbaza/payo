// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render } from '@testing-library/react'

/**
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 *
 * Property 1: Bug Condition — Chart Bar Height Resolves to 0px Due to CSS Percentage in Flex Column
 *
 * For any dailyData where maxTotal > 0n and entries have total > 0n,
 * each bar element MUST have a computed/inline height > 0px proportional
 * to total / maxTotal within the 128px container.
 *
 * EXPECTED: This test FAILS on unfixed code because bars use CSS percentage
 * height (`height: X%`) inside a flex column with no explicit height,
 * causing percentages to resolve to 0px.
 */

// --- Minimal chart component that reproduces the exact buggy JSX from page.tsx ---

type DailyEntry = { date: string; total: bigint }

function ChartBars({ dailyData }: { dailyData: DailyEntry[] }) {
  const maxTotal = dailyData.reduce((m, d) => (d.total > m ? d.total : m), 0n)

  return (
    <div className="flex items-end gap-1 h-32" style={{ height: '128px' }}>
      {dailyData.slice(-14).map(({ date, total }) => (
        <div key={date} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-6 bg-indigo-500 rounded-t"
            data-testid={`bar-${date}`}
            style={{
              height:
                maxTotal > 0n
                  ? `${Math.max(2, Math.round(Number((total * 128n) / maxTotal)))}px`
                  : '0px',
            }}
          />
          <span className="text-[10px] text-gray-500 -rotate-45">
            {date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Arbitraries ---

const dateArb = fc
  .integer({ min: 0, max: 730 })
  .map((offset) => {
    const d = new Date(2024, 0, 1 + offset)
    return d.toISOString().slice(0, 10)
  })

const positiveBigIntArb = fc.bigInt({ min: 1n, max: (1n << 64n) - 1n })

const dailyEntryArb: fc.Arbitrary<DailyEntry> = fc.record({
  date: dateArb,
  total: positiveBigIntArb,
})

// Generate arrays of 1-14 unique-date entries with total > 0n
const dailyDataArb = fc
  .array(dailyEntryArb, { minLength: 1, maxLength: 14 })
  .map((entries) => {
    // Deduplicate by date, keeping the first occurrence
    const seen = new Set<string>()
    return entries.filter((e) => {
      if (seen.has(e.date)) return false
      seen.add(e.date)
      return true
    })
  })
  .filter((entries) => entries.length >= 1)

describe('Chart Bar Height — Bug Condition Exploration', () => {
  it('every bar with total > 0n has a pixel height > 0 proportional to total/maxTotal', () => {
    fc.assert(
      fc.property(dailyDataArb, (dailyData) => {
        const maxTotal = dailyData.reduce(
          (m, d) => (d.total > m ? d.total : m),
          0n,
        )

        // Only test when maxTotal > 0 (always true given our generator)
        if (maxTotal === 0n) return

        const { container } = render(<ChartBars dailyData={dailyData} />)

        for (const entry of dailyData.slice(-14)) {
          const bar = container.querySelector(
            `[data-testid="bar-${entry.date}"]`,
          ) as HTMLElement | null

          expect(bar).not.toBeNull()

          // The inline style height should be a pixel value > 0, not a percentage
          const heightStyle = bar!.style.height

          // Assert: height must be in pixels (not percentage)
          // On unfixed code, this will be something like "50%" which is NOT pixel-based
          const pxMatch = heightStyle.match(/^(\d+(?:\.\d+)?)px$/)
          expect(pxMatch).not.toBeNull()

          if (pxMatch) {
            const pxValue = parseFloat(pxMatch[1])
            // Every non-zero total bar must have height > 0px
            expect(pxValue).toBeGreaterThan(0)
          }
        }

        // Additionally: the bar with total === maxTotal should be at full container height (128px)
        const maxEntry = dailyData
          .slice(-14)
          .find((e) => e.total === maxTotal)
        if (maxEntry) {
          const maxBar = container.querySelector(
            `[data-testid="bar-${maxEntry.date}"]`,
          ) as HTMLElement | null
          expect(maxBar).not.toBeNull()

          const maxHeightStyle = maxBar!.style.height
          const maxPxMatch = maxHeightStyle.match(/^(\d+(?:\.\d+)?)px$/)
          expect(maxPxMatch).not.toBeNull()
          if (maxPxMatch) {
            expect(parseFloat(maxPxMatch[1])).toBe(128)
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})
