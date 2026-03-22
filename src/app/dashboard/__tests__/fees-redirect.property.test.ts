import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: dashboard-fees-merge, Property 3: Redirect from /dashboard/fees
 *
 * For any request path that starts with `/dashboard/fees`, the middleware
 * should respond with a redirect to `/dashboard`.
 *
 * **Validates: Requirements 4.2**
 */

// Track redirect calls
let redirectUrl: URL | null = null

// Mock next/server — must be before middleware import
const mockHeaders = new Map<string, string>()
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => {
      redirectUrl = url
      return { type: 'redirect', url }
    },
    next: () => ({
      headers: {
        set: (key: string, value: string) => mockHeaders.set(key, value),
        get: (key: string) => mockHeaders.get(key),
      },
    }),
  },
}))

import { middleware } from '../../../../middleware'

describe('Feature: dashboard-fees-merge, Property 3: Redirect from /dashboard/fees', () => {
  beforeEach(() => {
    redirectUrl = null
    mockHeaders.clear()
  })

  function callMiddleware(pathname: string) {
    const url = 'http://localhost:3000' + pathname
    return middleware({
      nextUrl: { pathname },
      url,
    } as any)
  }

  it('any path starting with /dashboard/fees redirects to /dashboard', () => {
    fc.assert(
      fc.property(
        // Generate random URL-safe path suffixes (including empty string for exact /dashboard/fees)
        fc.stringMatching(/^[a-z0-9\-_/]{0,30}$/),
        (suffix) => {
          redirectUrl = null
          const pathname = `/dashboard/fees${suffix}`

          callMiddleware(pathname)

          // Middleware must have called redirect
          expect(redirectUrl).not.toBeNull()
          // Redirect target must be /dashboard
          expect(redirectUrl!.pathname).toBe('/dashboard')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('paths not starting with /dashboard/fees do not redirect', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '/',
          '/dashboard',
          '/dashboard/other',
          '/create',
          '/api/fees/0x123',
          '/dashboardfees',
        ),
        (pathname) => {
          redirectUrl = null

          callMiddleware(pathname)

          // Should NOT have redirected — should have called NextResponse.next() instead
          expect(redirectUrl).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})
