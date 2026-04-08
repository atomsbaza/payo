import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: nextjs-upgrade, Property 2: Security headers ครบถ้วนในทุก response
 * Validates: Requirements 4.2
 *
 * For any request path matching the middleware matcher pattern
 * (not _next/static, _next/image, or favicon.ico) and NOT starting
 * with /dashboard/fees, the middleware response SHALL have all 6
 * security headers: X-Frame-Options, X-Content-Type-Options,
 * Referrer-Policy, Permissions-Policy, Strict-Transport-Security,
 * Content-Security-Policy.
 */

// Capture headers set on the NextResponse.next() response
const mockHeaders = new Map<string, string>()

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => ({
      headers: {
        set: (key: string, value: string) => mockHeaders.set(key, value),
        get: (key: string) => mockHeaders.get(key),
      },
    }),
    redirect: (url: URL) => ({
      type: 'redirect',
      url: url.toString(),
      headers: {
        set: () => {},
        get: () => null,
      },
    }),
  },
}))

import { middleware } from '../../middleware'

describe('Feature: nextjs-upgrade, Property 2: Security headers ครบถ้วนในทุก response', () => {
  beforeEach(() => {
    mockHeaders.clear()
  })

  const REQUIRED_HEADERS = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
    'Content-Security-Policy',
  ] as const

  /**
   * Generate random valid paths that:
   * - Match the middleware matcher pattern (not _next/static, _next/image, favicon.ico)
   * - Do NOT start with /dashboard/fees (those get redirected instead)
   *
   * Examples: /, /create, /dashboard, /pay/abc123, /api/links
   */
  const validPathPrefixes = ['/', '/create', '/dashboard', '/pay', '/api/links', '/api/tx', '/api/fees', '/api/dashboard']

  const segmentArb = fc.string({ minLength: 1, maxLength: 12 })
    .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))

  const pathArb = fc.oneof(
    // Pick from known app paths
    fc.constantFrom(...validPathPrefixes),
    // Known paths with a random trailing segment
    fc.tuple(
      fc.constantFrom('/pay/', '/api/links/', '/api/dashboard/', '/api/tx/', '/api/fees/'),
      segmentArb
    ).map(([prefix, seg]) => `${prefix}${seg}`),
    // Fully random valid path segments
    fc.array(segmentArb, { minLength: 1, maxLength: 3 })
      .map(segments => '/' + segments.join('/'))
  ).filter(path =>
    // Exclude paths that would trigger redirect
    !path.startsWith('/dashboard/fees') &&
    // Exclude paths that don't match the middleware matcher
    !path.startsWith('/_next/static') &&
    !path.startsWith('/_next/image') &&
    path !== '/favicon.ico'
  )

  it('should set all 6 security headers for any valid non-redirect path', () => {
    fc.assert(
      fc.property(pathArb, (path) => {
        mockHeaders.clear()

        middleware({
          nextUrl: { pathname: path },
          url: `http://localhost:3000${path}`,
          headers: { get: (_key: string) => null },
        } as any)

        for (const header of REQUIRED_HEADERS) {
          expect(mockHeaders.has(header), `Missing header: ${header} for path: ${path}`).toBe(true)
          expect(mockHeaders.get(header), `Empty header: ${header} for path: ${path}`).toBeTruthy()
        }
      }),
      { numRuns: 100 }
    )
  })
})
