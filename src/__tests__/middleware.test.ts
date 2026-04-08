import { describe, it, expect, vi } from 'vitest'

// Mock next/server before importing middleware
const mockHeaders = new Map<string, string>()
const mockResponse = {
  headers: {
    set: (key: string, value: string) => mockHeaders.set(key, value),
    get: (key: string) => mockHeaders.get(key),
  },
}

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => mockResponse,
  },
}))

import { middleware } from '../../middleware'

describe('Security Header Middleware', () => {
  beforeEach(() => {
    mockHeaders.clear()
  })

  function callMiddleware(pathname = '/') {
    return middleware({
      nextUrl: { pathname },
      url: 'http://localhost:3000' + pathname,
      headers: { get: (_key: string) => null },
    } as any)
  }

  // Req 4.2: X-Frame-Options: DENY
  it('sets X-Frame-Options to DENY', () => {
    callMiddleware()
    expect(mockHeaders.get('X-Frame-Options')).toBe('DENY')
  })

  // Req 4.3: X-Content-Type-Options: nosniff
  it('sets X-Content-Type-Options to nosniff', () => {
    callMiddleware()
    expect(mockHeaders.get('X-Content-Type-Options')).toBe('nosniff')
  })

  // Req 4.4: Referrer-Policy
  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    callMiddleware()
    expect(mockHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  // Req 4.5: Permissions-Policy
  it('sets Permissions-Policy disabling camera, microphone, geolocation', () => {
    callMiddleware()
    expect(mockHeaders.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=()'
    )
  })

  // Req 4.6: Strict-Transport-Security
  it('sets Strict-Transport-Security with correct directives', () => {
    callMiddleware()
    expect(mockHeaders.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload'
    )
  })

  // Req 4.1: Content-Security-Policy
  it('sets Content-Security-Policy with required directives', () => {
    callMiddleware()
    const csp = mockHeaders.get('Content-Security-Policy')!
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("style-src 'self'")
    expect(csp).toContain('https://*.walletconnect.com')
    expect(csp).toContain('https://api-sepolia.basescan.org')
    expect(csp).toContain("frame-src 'self' https://*.walletconnect.com")
  })

  it('sets all 6 security headers', () => {
    callMiddleware()
    const requiredHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
      'Content-Security-Policy',
    ]
    for (const header of requiredHeaders) {
      expect(mockHeaders.has(header)).toBe(true)
    }
  })
})
