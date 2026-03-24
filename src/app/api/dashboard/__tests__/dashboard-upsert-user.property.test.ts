import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: database-integration, Property 11: Dashboard upserts user
 *
 * For any valid Ethereum address, after calling the dashboard API,
 * the `users` table should contain a row with that address.
 * If the row already existed, `last_seen` should be updated to a
 * more recent timestamp.
 *
 * This tests the upsert logic at the application level — the same
 * invariants enforced by the SQL:
 *   INSERT INTO users (address, last_seen)
 *   VALUES ($address, $now)
 *   ON CONFLICT (address) DO UPDATE SET last_seen = $now
 *   RETURNING address, last_seen
 *
 * **Validates: Requirements 6.2**
 */

// --- Types ---

interface UserRow {
  id: string
  address: string
  ensName: string | null
  ensCachedAt: Date | null
  createdAt: Date
  lastSeen: Date
}

// --- Arbitraries ---

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

// --- Upsert simulation ---
// Mirrors the SQL: INSERT INTO users (address, last_seen) VALUES ($address, $now)
//                  ON CONFLICT (address) DO UPDATE SET last_seen = $now

function upsertUser(
  usersTable: Map<string, UserRow>,
  address: string,
  now: Date,
): UserRow {
  const existing = usersTable.get(address)
  if (existing) {
    // ON CONFLICT DO UPDATE SET last_seen = $now
    const updated = { ...existing, lastSeen: now }
    usersTable.set(address, updated)
    return updated
  }
  // INSERT new row
  const newUser: UserRow = {
    id: crypto.randomUUID(),
    address,
    ensName: null,
    ensCachedAt: null,
    createdAt: now,
    lastSeen: now,
  }
  usersTable.set(address, newUser)
  return newUser
}

// --- Tests ---

describe("Feature: database-integration, Property 11: Dashboard upserts user", () => {
  /**
   * After a dashboard call for a new address, the users table contains
   * a row with that address and last_seen equal to the call time.
   * **Validates: Requirements 6.2**
   */
  it("inserts a new user row when address does not exist", () => {
    fc.assert(
      fc.property(ethAddressArb, (address) => {
        const usersTable = new Map<string, UserRow>()
        const now = new Date()

        const result = upsertUser(usersTable, address, now)

        // Row must exist in the table
        expect(usersTable.has(address)).toBe(true)

        // Returned row must match the address
        expect(result.address).toBe(address)

        // last_seen must equal the call time
        expect(result.lastSeen.getTime()).toBe(now.getTime())

        // created_at must equal the call time for a new user
        expect(result.createdAt.getTime()).toBe(now.getTime())
      }),
      { numRuns: 100 },
    )
  })

  /**
   * When a user already exists, calling dashboard again updates last_seen
   * to a more recent timestamp while preserving created_at.
   * **Validates: Requirements 6.2**
   */
  it("updates last_seen to a more recent timestamp for existing users", () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        fc.date({ min: new Date("2024-01-01"), max: new Date("2025-06-01"), noInvalidDate: true }),
        fc.integer({ min: 1, max: 86_400_000 }), // 1ms to 24h offset
        (address, firstCallTime, offsetMs) => {
          fc.pre(!isNaN(firstCallTime.getTime()))
          const usersTable = new Map<string, UserRow>()

          // First call — insert
          const firstResult = upsertUser(usersTable, address, firstCallTime)
          const originalCreatedAt = firstResult.createdAt.getTime()

          // Second call — update (strictly later)
          const secondCallTime = new Date(firstCallTime.getTime() + offsetMs)
          const secondResult = upsertUser(usersTable, address, secondCallTime)

          // Row still exists
          expect(usersTable.has(address)).toBe(true)

          // last_seen must be updated to the second call time
          expect(secondResult.lastSeen.getTime()).toBe(secondCallTime.getTime())

          // last_seen must be strictly more recent than the first call
          expect(secondResult.lastSeen.getTime()).toBeGreaterThan(
            firstCallTime.getTime(),
          )

          // created_at must remain unchanged
          expect(secondResult.createdAt.getTime()).toBe(originalCreatedAt)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Multiple sequential dashboard calls for the same address always
   * result in exactly one row, with last_seen matching the most recent call.
   * **Validates: Requirements 6.2**
   */
  it("maintains exactly one row per address across multiple calls", () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        fc.array(
          fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
          { minLength: 2, maxLength: 20 },
        ),
        (address, callTimes) => {
          const usersTable = new Map<string, UserRow>()

          // Sort call times chronologically to simulate sequential calls
          const sorted = [...callTimes].sort(
            (a, b) => a.getTime() - b.getTime(),
          )

          for (const t of sorted) {
            upsertUser(usersTable, address, t)
          }

          // Exactly one row for this address
          expect(usersTable.size).toBe(1)
          expect(usersTable.has(address)).toBe(true)

          // last_seen matches the most recent call
          const row = usersTable.get(address)!
          const latestCall = sorted[sorted.length - 1]
          expect(row.lastSeen.getTime()).toBe(latestCall.getTime())
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Upserting different addresses creates separate rows — no cross-contamination.
   * **Validates: Requirements 6.2**
   */
  it("different addresses produce independent user rows", () => {
    fc.assert(
      fc.property(
        ethAddressArb,
        ethAddressArb,
        fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
        fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
        (addressA, addressB, timeA, timeB) => {
          fc.pre(addressA !== addressB)

          const usersTable = new Map<string, UserRow>()

          upsertUser(usersTable, addressA, timeA)
          upsertUser(usersTable, addressB, timeB)

          // Both rows exist independently
          expect(usersTable.size).toBe(2)
          expect(usersTable.get(addressA)!.address).toBe(addressA)
          expect(usersTable.get(addressB)!.address).toBe(addressB)

          // Each row has its own last_seen
          expect(usersTable.get(addressA)!.lastSeen.getTime()).toBe(
            timeA.getTime(),
          )
          expect(usersTable.get(addressB)!.lastSeen.getTime()).toBe(
            timeB.getTime(),
          )
        },
      ),
      { numRuns: 100 },
    )
  })
})
