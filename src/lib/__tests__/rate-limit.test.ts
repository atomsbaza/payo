import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createRateLimiter } from '../rate-limit'

// Feature: security-hardening, Property 3: Rate limiter อนุญาต request ตาม limit แล้วปฏิเสธพร้อม retryAfter

describe('Rate Limiter', () => {
  it('Property 3: allows exactly `limit` requests then rejects with retryAfter > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (limit, key) => {
          const windowMs = 60_000
          const limiter = createRateLimiter(limit, windowMs)

          // First `limit` calls should all be allowed
          for (let i = 0; i < limit; i++) {
            const result = limiter.check(key)
            expect(result.allowed).toBe(true)
            expect(result.retryAfter).toBe(0)
          }

          // The (limit + 1)th call should be rejected
          const rejected = limiter.check(key)
          expect(rejected.allowed).toBe(false)
          expect(rejected.retryAfter).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 3b: different keys have independent limits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 2 }),
        (limit, keys) => {
          const limiter = createRateLimiter(limit, 60_000)
          const [keyA, keyB] = keys

          // Exhaust limit for keyA
          for (let i = 0; i < limit; i++) {
            limiter.check(keyA)
          }
          expect(limiter.check(keyA).allowed).toBe(false)

          // keyB should still be allowed
          expect(limiter.check(keyB).allowed).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
