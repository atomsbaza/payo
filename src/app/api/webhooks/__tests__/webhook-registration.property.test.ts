import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

// Feature: n8n-webhook, Property 2: Webhook registration round-trip
// Feature: n8n-webhook, Property 3: One registration per owner invariant

/**
 * Property 2: Webhook registration round-trip
 *
 * For any valid Ethereum address and valid HTTPS URL, registering the webhook
 * then retrieving the configuration for that address SHALL return the same URL
 * that was registered.
 *
 * **Validates: Requirements 1.3**
 */

/**
 * Property 3: One registration per owner invariant
 *
 * For any owner address, after any sequence of register/update operations,
 * the `webhook_registrations` table SHALL contain at most one row for that
 * owner address.
 *
 * **Validates: Requirements 1.6**
 */

// ---------------------------------------------------------------------------
// In-memory DB mock
// ---------------------------------------------------------------------------
// Simulates the Drizzle query builder chain used by the route handlers:
//   select().from().where().limit()  → returns matching rows
//   insert().values()                → inserts a row
//   update().set().where()           → updates matching rows
//   delete().where()                 → deletes matching rows
// ---------------------------------------------------------------------------

type RegistrationRow = {
  ownerAddress: string
  webhookUrl: string
  webhookSecret: string
  createdAt: Date
  updatedAt: Date
  lastTriggeredAt: Date | null
}

function createInMemoryDb() {
  const store = new Map<string, RegistrationRow>()

  return {
    _store: store,

    select: () => ({
      from: () => ({
        where: (condition: { _owner: string }) => ({
          limit: (_n: number) => {
            const row = store.get(condition._owner)
            return Promise.resolve(row ? [row] : [])
          },
        }),
      }),
    }),

    insert: () => ({
      values: (row: RegistrationRow) => {
        store.set(row.ownerAddress, row)
        return Promise.resolve()
      },
    }),

    update: () => ({
      set: (patch: Partial<RegistrationRow>) => ({
        where: (condition: { _owner: string }) => {
          const existing = store.get(condition._owner)
          if (existing) {
            store.set(condition._owner, { ...existing, ...patch })
          }
          return Promise.resolve()
        },
      }),
    }),

    delete: () => ({
      where: (condition: { _owner: string }) => {
        store.delete(condition._owner)
        return Promise.resolve()
      },
    }),
  }
}

// ---------------------------------------------------------------------------
// Mock @/lib/db and drizzle-orm helpers
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: vi.fn(() => true),
  getDb: vi.fn(),
}))

// Mock drizzle-orm eq() to return an object carrying the owner address so
// our in-memory DB can use it for lookups.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (_col: unknown, value: string) => ({ _owner: value }),
    desc: actual.desc,
  }
})

// Mock the schema tables — the route only uses them as identifiers passed to
// .from() / .where(), so plain objects are sufficient.
vi.mock('@/lib/schema', () => ({
  webhookRegistrations: { ownerAddress: 'ownerAddress' },
  webhookLogs: { ownerAddress: 'ownerAddress', createdAt: 'createdAt' },
}))

// Mock generateWebhookSecret to return a deterministic 64-char hex string.
vi.mock('@/lib/webhook', () => ({
  generateWebhookSecret: () => 'a'.repeat(64),
}))

// ---------------------------------------------------------------------------
// Helpers to call the route handlers
// ---------------------------------------------------------------------------

async function callPost(db: ReturnType<typeof createInMemoryDb>, address: string, url: string) {
  const { getDb } = await import('@/lib/db')
  vi.mocked(getDb).mockReturnValue(db as any)

  const { POST } = await import('@/app/api/webhooks/[address]/route')
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: { 'Content-Type': 'application/json' },
  })
  const params = Promise.resolve({ address })
  return POST(req as any, { params })
}

async function callGet(db: ReturnType<typeof createInMemoryDb>, address: string) {
  const { getDb } = await import('@/lib/db')
  vi.mocked(getDb).mockReturnValue(db as any)

  // GET also queries webhookLogs — extend the mock to handle that second query
  const dbWithLogs = {
    ...db,
    select: () => ({
      from: (table: { ownerAddress: string }) => {
        // Detect if this is a logs query by checking the table shape
        if ('createdAt' in table) {
          return {
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }
        }
        return {
          where: (condition: { _owner: string }) => ({
            limit: (_n: number) => {
              const row = db._store.get(condition._owner)
              return Promise.resolve(row ? [row] : [])
            },
          }),
        }
      },
    }),
  }

  vi.mocked(getDb).mockReturnValue(dbWithLogs as any)

  const { GET } = await import('@/app/api/webhooks/[address]/route')
  const req = new Request(`http://localhost/api/webhooks/${address}`)
  const params = Promise.resolve({ address })
  return GET(req as any, { params })
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map(chars => '0x' + chars.join(''))

const httpsUrlArb = fc.webUrl().map(u => u.replace(/^http:/, 'https:'))

// ---------------------------------------------------------------------------
// Property 2: Webhook registration round-trip
// ---------------------------------------------------------------------------

describe('Feature: n8n-webhook, Property 2: Webhook registration round-trip', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns the same URL that was registered via POST', async () => {
    await fc.assert(
      fc.asyncProperty(ethAddressArb, httpsUrlArb, async (address, url) => {
        const db = createInMemoryDb()

        // Register the webhook
        const postRes = await callPost(db, address, url)
        expect(postRes.status).toBe(201)

        // Retrieve the configuration
        const getRes = await callGet(db, address)
        expect(getRes.status).toBe(200)

        const body = await getRes.json()
        expect(body.url).toBe(url)
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: One registration per owner invariant
// ---------------------------------------------------------------------------

describe('Feature: n8n-webhook, Property 3: One registration per owner invariant', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('contains at most one row per owner after any sequence of register/update operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        ethAddressArb,
        fc.array(httpsUrlArb, { minLength: 1, maxLength: 10 }),
        async (address, urls) => {
          const db = createInMemoryDb()

          // Apply each URL in sequence (first is insert, rest are updates)
          for (const url of urls) {
            const res = await callPost(db, address, url)
            // Each call must succeed (201 for first, 200 for updates)
            expect(res.status === 200 || res.status === 201).toBe(true)
          }

          // The store must contain exactly one row for this owner
          const rowCount = [...db._store.keys()].filter(k => k === address).length
          expect(rowCount).toBe(1)

          // And the stored URL must be the last one submitted
          const storedRow = db._store.get(address)
          expect(storedRow?.webhookUrl).toBe(urls[urls.length - 1])
        },
      ),
      { numRuns: 100 },
    )
  })
})
