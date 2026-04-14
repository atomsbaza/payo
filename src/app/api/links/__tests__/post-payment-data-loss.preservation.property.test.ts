import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { createRateLimiter } from '@/lib/rate-limit'
import {
  encodeTransferLink,
  decodeTransferLink,
  type TransferLinkData,
} from '@/lib/encode'
import { signTransferLink, verifyTransferLink } from '@/lib/hmac'
import { hashIp, truncateUserAgent } from '@/lib/link-events'

/**
 * Bugfix: post-payment-data-loss — Preservation Property Tests
 *
 * Property 2: Preservation — พฤติกรรมเดิมไม่เปลี่ยนแปลง
 *
 * These tests are written BEFORE any code fix. They capture baseline behavior
 * on the unfixed codebase and are EXPECTED TO PASS, establishing invariants
 * that must be preserved after the bugfix.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
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

/** Memo: 0-200 grapheme-safe characters */
const memoArb = fc.string({ minLength: 0, maxLength: 200, unit: 'grapheme' })

/** IP address arbitrary */
const ipArb = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 255 }),
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

/** User agent arbitrary */
const userAgentArb = fc.string({ minLength: 1, maxLength: 200 })

// =========================================================================
// Preservation 1: Dashboard GET upserts user correctly
// Simulates the upsert logic from GET /api/dashboard/[address]
// =========================================================================

interface UserRow {
  address: string
  lastSeen: Date
  createdAt: Date
}

/**
 * Simulates the dashboard upsert SQL:
 *   INSERT INTO users (address, last_seen) VALUES ($address, $now)
 *   ON CONFLICT (address) DO UPDATE SET last_seen = $now
 *   RETURNING address, last_seen
 */
function dashboardUpsertUser(
  usersTable: Map<string, UserRow>,
  address: string,
  now: Date,
): UserRow {
  const existing = usersTable.get(address)
  if (existing) {
    const updated = { ...existing, lastSeen: now }
    usersTable.set(address, updated)
    return updated
  }
  const newUser: UserRow = { address, createdAt: now, lastSeen: now }
  usersTable.set(address, newUser)
  return newUser
}

describe('Preservation: Post-Payment Data Loss Bugfix', () => {
  // -----------------------------------------------------------------------
  // Preservation 1: Dashboard upsert user
  // Validates: Requirement 3.1
  // -----------------------------------------------------------------------
  describe('Preservation 1: Dashboard GET upserts user correctly', () => {
    /**
     * For any valid Ethereum address, dashboard GET must upsert user —
     * insert if new, update last_seen if existing.
     *
     * **Validates: Requirements 3.1**
     */
    it('upserts user for any valid Ethereum address', () => {
      fc.assert(
        fc.property(ethAddressArb, (address) => {
          const usersTable = new Map<string, UserRow>()
          const now = new Date()

          const result = dashboardUpsertUser(usersTable, address, now)

          // Row must exist
          expect(usersTable.has(address)).toBe(true)
          expect(result.address).toBe(address)
          expect(result.lastSeen.getTime()).toBe(now.getTime())
        }),
        { numRuns: 100 },
      )
    })

    /**
     * Repeated dashboard calls for the same address update last_seen
     * without creating duplicate rows.
     *
     * **Validates: Requirements 3.1**
     */
    it('updates last_seen on repeated calls without duplicating rows', () => {
      fc.assert(
        fc.property(
          ethAddressArb,
          fc.integer({ min: 1, max: 86_400_000 }),
          (address, offsetMs) => {
            const usersTable = new Map<string, UserRow>()
            const firstTime = new Date('2025-01-01T00:00:00Z')
            const secondTime = new Date(firstTime.getTime() + offsetMs)

            dashboardUpsertUser(usersTable, address, firstTime)
            const result = dashboardUpsertUser(usersTable, address, secondTime)

            // Still exactly one row
            expect(usersTable.size).toBe(1)
            // last_seen updated to second call time
            expect(result.lastSeen.getTime()).toBe(secondTime.getTime())
            // created_at preserved from first call
            expect(result.createdAt.getTime()).toBe(firstTime.getTime())
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  // -----------------------------------------------------------------------
  // Preservation 2: GET /api/links/[id] logs "viewed" event and increments view_count
  // Validates: Requirement 3.2
  // -----------------------------------------------------------------------
  describe('Preservation 2: GET /api/links/[id] logs viewed event and increments view_count', () => {
    /**
     * Simulates the view event logging and view_count increment from
     * GET /api/links/[id]. For any valid link, viewing it must:
     * - Log a "viewed" event with the link ID
     * - Increment view_count by exactly 1
     *
     * **Validates: Requirements 3.2**
     */

    interface LinkRow {
      linkId: string
      viewCount: number
    }

    interface EventRow {
      linkId: string
      eventType: string
      ipHash: string | null
      userAgent: string | null
    }

    function simulateViewLink(
      linksTable: Map<string, LinkRow>,
      eventsLog: EventRow[],
      linkId: string,
      ip?: string,
      userAgent?: string,
    ): { found: boolean; viewCount: number } {
      const link = linksTable.get(linkId)
      if (!link) return { found: false, viewCount: 0 }

      // Atomic increment: SET view_count = view_count + 1
      link.viewCount = link.viewCount + 1
      linksTable.set(linkId, link)

      // Log "viewed" event (fire-and-forget in real code)
      eventsLog.push({
        linkId,
        eventType: 'viewed',
        ipHash: ip ? hashIp(ip) : null,
        userAgent: userAgent ? truncateUserAgent(userAgent) : null,
      })

      return { found: true, viewCount: link.viewCount }
    }

    it('increments view_count by 1 for each view and logs viewed event', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 50 }),
          ipArb,
          userAgentArb,
          (linkId, viewCount, ip, userAgent) => {
            const linksTable = new Map<string, LinkRow>()
            const eventsLog: EventRow[] = []

            // Seed a link with view_count = 0
            linksTable.set(linkId, { linkId, viewCount: 0 })

            for (let i = 0; i < viewCount; i++) {
              simulateViewLink(linksTable, eventsLog, linkId, ip, userAgent)
            }

            // view_count must equal the number of views
            expect(linksTable.get(linkId)!.viewCount).toBe(viewCount)

            // Each view must produce exactly one "viewed" event
            expect(eventsLog.length).toBe(viewCount)
            for (const event of eventsLog) {
              expect(event.linkId).toBe(linkId)
              expect(event.eventType).toBe('viewed')
            }
          },
        ),
        { numRuns: 100 },
      )
    })

    it('hashes IP and truncates user agent in viewed events', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          ipArb,
          fc.string({ minLength: 1, maxLength: 600 }),
          (linkId, ip, longUserAgent) => {
            const linksTable = new Map<string, LinkRow>()
            const eventsLog: EventRow[] = []

            linksTable.set(linkId, { linkId, viewCount: 0 })
            simulateViewLink(linksTable, eventsLog, linkId, ip, longUserAgent)

            const event = eventsLog[0]
            // IP must be hashed (64 hex chars SHA-256)
            expect(event.ipHash).toMatch(/^[a-f0-9]{64}$/)
            expect(event.ipHash).toBe(hashIp(ip))
            // User agent must be truncated to 512 chars max
            expect(event.userAgent!.length).toBeLessThanOrEqual(512)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  // -----------------------------------------------------------------------
  // Preservation 3: POST /api/links without DATABASE_URL uses in-memory fallback
  // Validates: Requirement 3.4
  // -----------------------------------------------------------------------
  describe('Preservation 3: POST /api/links uses in-memory fallback without DATABASE_URL', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    /**
     * When DATABASE_URL is not configured, POST /api/links must use the
     * in-memory counter and still return a valid link response (200 OK).
     *
     * **Validates: Requirements 3.4**
     */
    it('returns 200 with valid link data when DATABASE_URL is not set', async () => {
      // Mock db module to simulate no DATABASE_URL
      vi.doMock('@/lib/db', () => ({
        isDatabaseConfigured: () => false,
        getDb: () => { throw new Error('No DATABASE_URL') },
        db: new Proxy({}, {
          get() { throw new Error('No DATABASE_URL') },
        }),
      }))

      // Mock rate limiter to always allow
      vi.doMock('@/lib/rate-limit', () => ({
        createRateLimiter: () => ({
          check: () => ({ allowed: true, retryAfter: 0 }),
        }),
      }))

      const { POST } = await import('../route')

      await fc.assert(
        fc.asyncProperty(
          ethAddressArb,
          chainTokenArb,
          amountArb,
          async (address, { chainId, token }, amount) => {
            const req = new NextRequest('http://localhost:3000/api/links', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ address, token, amount, memo: '', chainId }),
            })

            const res = await POST(req)

            // Must succeed with 200
            expect(res.status).toBe(200)

            const json = await res.json()
            // Must return id and url
            expect(json.id).toBeTruthy()
            expect(json.url).toBeTruthy()
            // Must return signed data
            expect(json.data).toBeTruthy()
            expect(json.data.signature).toBeTruthy()
          },
        ),
        { numRuns: 20 },
      )
    })
  })

  // -----------------------------------------------------------------------
  // Preservation 4: HMAC tamper detection logs tamper_blocked event
  // Validates: Requirement 3.5
  // -----------------------------------------------------------------------
  describe('Preservation 4: HMAC tamper detection', () => {
    /**
     * When a payment link's data is modified after signing, HMAC verification
     * must fail (tampered = true). The GET handler logs a "tamper_blocked" event
     * in this case. We verify the detection logic here.
     *
     * **Validates: Requirements 3.5**
     */
    it('detects tampered links for any modified address', () => {
      fc.assert(
        fc.property(
          ethAddressArb,
          chainTokenArb,
          amountArb,
          memoArb,
          ethAddressArb,
          (address, { chainId, token }, amount, memo, differentAddress) => {
            fc.pre(differentAddress !== address)

            // Sign with original address
            const data: TransferLinkData = { address, token, amount, memo, chainId }
            const signature = signTransferLink(data)

            // Tamper: swap address but keep original signature
            const tamperedData: TransferLinkData = {
              ...data,
              address: differentAddress,
              signature,
            }

            // Verification must fail
            expect(verifyTransferLink(tamperedData)).toBe(false)

            // The GET handler would log "tamper_blocked" for this case
            // We verify the detection condition: !verifyPaymentLink(data)
            const linkId = encodeTransferLink(tamperedData)
            const decoded = decodeTransferLink(linkId)
            expect(decoded).not.toBeNull()
            expect(verifyTransferLink(decoded!)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  // -----------------------------------------------------------------------
  // Preservation 5: Rate limit exceeded returns 429
  // Validates: Requirement 3.6
  // -----------------------------------------------------------------------
  describe('Preservation 5: Rate limit exceeded returns 429', () => {
    /**
     * For any rate limit configuration, after exhausting the limit,
     * subsequent requests must be blocked with retryAfter > 0.
     * The POST /api/links handler returns 429 in this case.
     *
     * **Validates: Requirements 3.6**
     */
    it('blocks requests after limit is exhausted with positive retryAfter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1_000, max: 120_000 }),
          ipArb,
          (limit, windowMs, ip) => {
            const limiter = createRateLimiter(limit, windowMs)

            // Exhaust the limit
            for (let i = 0; i < limit; i++) {
              const result = limiter.check(ip)
              expect(result.allowed).toBe(true)
            }

            // Next request must be blocked
            const blocked = limiter.check(ip)
            expect(blocked.allowed).toBe(false)
            expect(blocked.retryAfter).toBeGreaterThan(0)
          },
        ),
        { numRuns: 100 },
      )
    })

    /**
     * Different IPs have independent rate limits — exhausting one IP
     * does not affect another.
     *
     * **Validates: Requirements 3.6**
     */
    it('different IPs have independent rate limits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1_000, max: 60_000 }),
          fc.uniqueArray(ipArb, { minLength: 2, maxLength: 2 }),
          (limit, windowMs, ips) => {
            const limiter = createRateLimiter(limit, windowMs)
            const [ipA, ipB] = ips

            // Exhaust limit for ipA
            for (let i = 0; i < limit; i++) {
              limiter.check(ipA)
            }
            expect(limiter.check(ipA).allowed).toBe(false)

            // ipB should still be fully available
            const result = limiter.check(ipB)
            expect(result.allowed).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
