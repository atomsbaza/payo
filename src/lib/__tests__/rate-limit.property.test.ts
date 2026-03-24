import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRateLimiter } from '../rate-limit';

/**
 * Feature: database-integration, Property 9: Rate limiter correctness
 *
 * For any key (IP address) and configured limit L within a time window,
 * the first L requests should be allowed (allowed: true) and request L+1
 * should be blocked (allowed: false) with a positive Retry-After value.
 *
 * This tests the in-memory fallback rate limiter (no DATABASE_URL needed).
 *
 * **Validates: Requirements 5.2, 5.3**
 */

// --- Arbitraries ---

const limitArb = fc.integer({ min: 1, max: 50 });
const windowMsArb = fc.integer({ min: 1_000, max: 120_000 });
const keyArb = fc.string({ minLength: 1, maxLength: 30 });

// --- Tests ---

describe('Feature: database-integration, Property 9: Rate limiter correctness', () => {
  /**
   * First L requests are allowed, request L+1 is blocked with positive retryAfter.
   * **Validates: Requirements 5.2, 5.3**
   */
  it('allows exactly L requests then blocks request L+1 with positive Retry-After', () => {
    fc.assert(
      fc.property(limitArb, windowMsArb, keyArb, (limit, windowMs, key) => {
        const limiter = createRateLimiter(limit, windowMs);

        // First L requests should all be allowed with retryAfter = 0
        for (let i = 0; i < limit; i++) {
          const result = limiter.check(key);
          expect(result.allowed).toBe(true);
          expect(result.retryAfter).toBe(0);
        }

        // Request L+1 should be blocked with positive retryAfter
        const blocked = limiter.check(key);
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfter).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * All requests beyond L are consistently blocked within the same window.
   * **Validates: Requirements 5.2, 5.3**
   */
  it('all requests beyond limit L remain blocked within the window', () => {
    fc.assert(
      fc.property(
        limitArb,
        windowMsArb,
        keyArb,
        fc.integer({ min: 1, max: 20 }),
        (limit, windowMs, key, extraRequests) => {
          const limiter = createRateLimiter(limit, windowMs);

          // Exhaust the limit
          for (let i = 0; i < limit; i++) {
            limiter.check(key);
          }

          // Every subsequent request should also be blocked
          for (let i = 0; i < extraRequests; i++) {
            const result = limiter.check(key);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Different keys have independent rate limits — exhausting one key
   * does not affect another.
   * **Validates: Requirements 5.2**
   */
  it('different keys have independent rate limits', () => {
    fc.assert(
      fc.property(
        limitArb,
        windowMsArb,
        fc.uniqueArray(keyArb, { minLength: 2, maxLength: 2 }),
        (limit, windowMs, keys) => {
          const limiter = createRateLimiter(limit, windowMs);
          const [keyA, keyB] = keys;

          // Exhaust limit for keyA
          for (let i = 0; i < limit; i++) {
            limiter.check(keyA);
          }
          expect(limiter.check(keyA).allowed).toBe(false);

          // keyB should still be fully available
          for (let i = 0; i < limit; i++) {
            const result = limiter.check(keyB);
            expect(result.allowed).toBe(true);
          }
          expect(limiter.check(keyB).allowed).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
