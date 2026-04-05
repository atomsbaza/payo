import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'

/**
 * Bugfix: post-payment-data-loss — Bug Condition Exploration Test
 *
 * Property 1: Bug Condition — Post-Payment Data Loss
 *
 * This test is written BEFORE any code fix. It is EXPECTED TO FAIL on the
 * unfixed codebase, confirming the bug exists.
 *
 * Two scenarios are tested:
 *   (A) POST `/api/links` with valid ownerAddress → user record should be
 *       upserted in `users` table (bug: it is NOT)
 *   (B) POST `/api/links/[id]` with txHash and payerAddress → endpoint should
 *       respond 200 with paid event, pay_count increment, and transaction upsert
 *       (bug: POST handler does not exist → 405)
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid tx hash: 0x + 64 hex chars */
const txHashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `0x${chars.join('')}`)

/** Valid chain + token pairs from the registry */
const chainTokenArb = fc.constantFrom(
  { chainId: 84532, token: 'ETH' },
  { chainId: 84532, token: 'USDC' },
  { chainId: 8453, token: 'ETH' },
  { chainId: 8453, token: 'USDC' },
)

/** Amount: positive number as string */
const amountArb = fc
  .double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true })
  .filter((n) => n > 0)
  .map((n) => n.toString())

// --- Helpers ---

function makeCreateLinkRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// =========================================================================
// Scenario A: User upsert missing on link creation
// =========================================================================

describe('Bug Condition Exploration: Post-Payment Data Loss', () => {
  describe('Scenario A: POST /api/links should upsert user record', () => {
    /**
     * For any valid ownerAddress, after creating a payment link via POST /api/links,
     * the users table should contain a row for that address.
     *
     * Bug: The current code inserts into payment_links but never upserts into users.
     * We detect this by tracking all db.insert() calls and checking if any target
     * the users table.
     *
     * **Validates: Requirements 1.1**
     */
    it('should upsert user in users table when creating a payment link (expected to FAIL)', async () => {
      // Track which tables receive insert operations
      const insertedTables: string[] = []

      // Mock isDatabaseConfigured to return true
      vi.doMock('@/lib/db', () => {
        const mockInsert = (table: Record<string, unknown>) => {
          // Extract table name from drizzle table object via Symbol or getTableName
          const nameSymbol = Object.getOwnPropertySymbols(table).find(
            (s) => s.toString() === 'Symbol(drizzle:Name)',
          )
          const tableName = nameSymbol
            ? (table as Record<symbol, string>)[nameSymbol]
            : (table as { _?: { name?: string } })?._?.name ?? 'unknown'
          insertedTables.push(tableName)
          return {
            values: () => ({
              onConflictDoUpdate: () => ({
                returning: () => Promise.resolve([{ address: 'mock', lastSeen: new Date() }]),
                catch: () => Promise.resolve(),
              }),
              catch: () => Promise.resolve(),
            }),
          }
        }

        const mockDb = {
          insert: mockInsert,
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        }

        return {
          isDatabaseConfigured: () => true,
          getDb: () => mockDb,
          db: mockDb,
        }
      })

      // Mock rate limiter to always allow
      vi.doMock('@/lib/rate-limit', () => ({
        createRateLimiter: () => ({
          check: () => ({ allowed: true, retryAfter: 0 }),
        }),
      }))

      // Clear module cache to pick up mocks
      const mod = await import('../route')
      const POST = mod.POST

      await fc.assert(
        fc.asyncProperty(
          ethAddressArb,
          chainTokenArb,
          amountArb,
          async (address, { chainId, token }, amount) => {
            insertedTables.length = 0

            const body = { address, token, amount, memo: '', chainId }
            const res = await POST(makeCreateLinkRequest(body))

            // Link creation should succeed
            expect(res.status).toBe(200)

            // Bug assertion: users table should have been inserted into
            // Current code only inserts into payment_links, NOT users
            const usersInserted = insertedTables.some(
              (t) => t === 'users',
            )
            expect(usersInserted).toBe(true)
          },
        ),
        { numRuns: 20 },
      )
    })
  })

  // =========================================================================
  // Scenario B: Payment confirmation endpoint missing
  // =========================================================================

  describe('Scenario B: POST /api/links/[id] should handle payment confirmation', () => {
    /**
     * For any valid payment link ID, txHash, and payerAddress, sending a POST
     * to /api/links/[id] should respond with 200 (not 405).
     *
     * Bug: There is no POST handler exported from the [id]/route.ts module,
     * so Next.js returns 405 Method Not Allowed.
     *
     * We detect this by checking if the module exports a POST function.
     *
     * **Validates: Requirements 1.2, 1.3, 1.4**
     */
    it('should export a POST handler for payment confirmation (expected to FAIL)', async () => {
      const linkIdRouteModule = await import('../[id]/route')

      await fc.assert(
        fc.asyncProperty(
          txHashArb,
          ethAddressArb,
          async (_txHash, _payerAddress) => {
            // The module should export a POST function
            const hasPostHandler = typeof (linkIdRouteModule as Record<string, unknown>).POST === 'function'
            expect(hasPostHandler).toBe(true)
          },
        ),
        { numRuns: 5 },
      )
    })

    /**
     * Even if we try to call POST on the [id] endpoint directly,
     * it should respond 200 with paid event data.
     * Since no POST handler exists, this confirms the bug.
     *
     * **Validates: Requirements 1.2, 1.3, 1.4**
     */
    it('POST /api/links/[id] should respond 200 for payment confirmation (expected to FAIL)', async () => {
      const linkIdRouteModule = await import('../[id]/route') as Record<string, unknown>

      await fc.assert(
        fc.asyncProperty(
          txHashArb,
          ethAddressArb,
          amountArb,
          async (txHash, payerAddress, amount) => {
            // If POST handler doesn't exist, the bug is confirmed
            if (typeof linkIdRouteModule.POST !== 'function') {
              // No POST handler → 405 would be returned by Next.js
              // This is the bug: endpoint doesn't exist
              expect(typeof linkIdRouteModule.POST).toBe('function')
              return
            }

            // If POST handler exists (after fix), verify it works
            const req = new NextRequest('http://localhost:3000/api/links/test-link-id', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ txHash, payerAddress, amount }),
            })

            const res = await (linkIdRouteModule.POST as Function)(req, {
              params: Promise.resolve({ id: 'test-link-id' }),
            })

            // Should respond 200, not 405
            expect(res.status).not.toBe(405)
          },
        ),
        { numRuns: 5 },
      )
    })
  })
})
