import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: nextjs-upgrade, Property 1: Middleware redirect สำหรับ /dashboard/fees
 * Validates: Requirements 4.1
 *
 * For any request path starting with /dashboard/fees,
 * middleware SHALL return a redirect response to /dashboard.
 */

// Track redirect calls
let lastRedirectUrl: string | null = null

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => {
      lastRedirectUrl = url.pathname
      return { type: 'redirect', url: url.toString() }
    },
    next: () => ({
      headers: {
        set: () => {},
        get: () => null,
      },
    }),
  },
}))

import { middleware } from '../../middleware'

describe('Feature: nextjs-upgrade, Property 1: Middleware redirect สำหรับ /dashboard/fees', () => {
  beforeEach(() => {
    lastRedirectUrl = null
  })

  /**
   * Generates random sub-path segments to append after /dashboard/fees.
   * Examples: "", "/123", "/abc/xyz", "/foo/bar/baz"
   */
  const segmentArb = fc.string({ minLength: 1, maxLength: 10 })
    .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))

  const subPathArb = fc.array(segmentArb, { minLength: 0, maxLength: 4 })
    .map(segments => segments.length === 0 ? '' : '/' + segments.join('/'))

  it('should redirect any /dashboard/fees path to /dashboard', () => {
    fc.assert(
      fc.property(subPathArb, (subPath) => {
        lastRedirectUrl = null
        const pathname = `/dashboard/fees${subPath}`

        const result = middleware({
          nextUrl: { pathname },
          url: `http://localhost:3000${pathname}`,
        } as any)

        // Must be a redirect response
        expect(result).toBeDefined()
        expect(lastRedirectUrl).toBe('/dashboard')
      }),
      { numRuns: 100 }
    )
  })
})
