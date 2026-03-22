import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 4: Auto-scroll เกิดขึ้นครั้งเดียว
 *
 * For any sequence of liveUrl changes on the Create Page,
 * `scrollIntoView` is called at most 1 time — no matter how many
 * times form fields change after the QR section first appears.
 *
 * We replicate the core logic from create/page.tsx:
 *   let hasScrolled = false
 *   function processUrlChange(liveUrl, scrollFn) {
 *     if (liveUrl && !hasScrolled) { scrollFn(); hasScrolled = true }
 *   }
 *
 * **Validates: Requirements 4.2**
 */

/**
 * Simulates the auto-scroll guard logic extracted from the useEffect
 * in create/page.tsx. Returns how many times scrollFn was invoked.
 */
function countScrollCalls(urlSequence: string[]): number {
  let hasScrolled = false
  let scrollCount = 0

  const scrollFn = () => {
    scrollCount++
  }

  for (const liveUrl of urlSequence) {
    if (liveUrl && !hasScrolled) {
      scrollFn()
      hasScrolled = true
    }
  }

  return scrollCount
}

// Generator: a truthy URL string (non-empty, simulating a valid payment link)
const truthyUrlArb = fc
  .webUrl()
  .filter((u) => u.length > 0)

// Generator: a liveUrl value — either empty (QR not shown) or truthy (QR shown)
const liveUrlArb = fc.oneof(fc.constant(''), truthyUrlArb)

// Generator: a sequence of liveUrl changes (1–50 changes)
const urlSequenceArb = fc.array(liveUrlArb, { minLength: 1, maxLength: 50 })

// Feature: ux-polish, Property 4: Auto-scroll เกิดขึ้นครั้งเดียว
describe('Create Page — Property 4: Auto-scroll เกิดขึ้นครั้งเดียว', () => {
  it('scrollIntoView is called at most 1 time for any sequence of liveUrl changes', () => {
    fc.assert(
      fc.property(urlSequenceArb, (urls) => {
        const calls = countScrollCalls(urls)
        expect(calls).toBeLessThanOrEqual(1)
      }),
      { numRuns: 100 },
    )
  })

  it('scrollIntoView is called exactly 1 time when at least one truthy URL exists', () => {
    // Ensure at least one truthy URL in the sequence
    const sequenceWithTruthyArb = fc
      .tuple(
        fc.array(liveUrlArb, { minLength: 0, maxLength: 20 }),
        truthyUrlArb,
        fc.array(liveUrlArb, { minLength: 0, maxLength: 20 }),
      )
      .map(([before, truthy, after]) => [...before, truthy, ...after])

    fc.assert(
      fc.property(sequenceWithTruthyArb, (urls) => {
        const calls = countScrollCalls(urls)
        expect(calls).toBe(1)
      }),
      { numRuns: 100 },
    )
  })

  it('scrollIntoView is never called when all URLs are empty', () => {
    const allEmptyArb = fc.array(fc.constant(''), { minLength: 1, maxLength: 50 })

    fc.assert(
      fc.property(allEmptyArb, (urls) => {
        const calls = countScrollCalls(urls)
        expect(calls).toBe(0)
      }),
      { numRuns: 100 },
    )
  })
})
