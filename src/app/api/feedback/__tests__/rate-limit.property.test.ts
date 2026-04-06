import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { createRateLimiter } from '@/lib/rate-limit'

/**
 * Feature: contact-feedback-page, Property 7: Rate limiter allows exactly 3 requests then blocks
 *
 * For any IP address string, the rate limiter SHALL allow the first 3 requests
 * within a 60-minute window and SHALL reject the 4th and subsequent requests
 * with HTTP 429 containing retryAfter.
 *
 * **Validates: Requirements 5.1, 5.2**
 */

describe('Feature: contact-feedback-page, Property 7: Rate limiter allows exactly 3 requests then blocks', () => {
  it('allows first 3 requests and blocks the 4th for any IP string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (ip) => {
          // Fresh limiter per test run (3 requests / 60 min)
          const limiter = createRateLimiter(3, 60 * 60 * 1000)

          // First 3 requests must be allowed
          for (let i = 0; i < 3; i++) {
            const result = limiter.check(ip)
            expect(result.allowed).toBe(true)
            expect(result.retryAfter).toBe(0)
          }

          // 4th request must be blocked with retryAfter > 0
          const blocked = limiter.check(ip)
          expect(blocked.allowed).toBe(false)
          expect(blocked.retryAfter).toBeGreaterThan(0)

          // 5th request also blocked
          const alsoBlocked = limiter.check(ip)
          expect(alsoBlocked.allowed).toBe(false)
          expect(alsoBlocked.retryAfter).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('different IPs have independent rate limit windows', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (ipA, ipB) => {
          fc.pre(ipA !== ipB)

          const limiter = createRateLimiter(3, 60 * 60 * 1000)

          // Exhaust ipA's limit
          for (let i = 0; i < 3; i++) limiter.check(ipA)
          expect(limiter.check(ipA).allowed).toBe(false)

          // ipB should still be allowed
          expect(limiter.check(ipB).allowed).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
