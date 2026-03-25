import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as fc from 'fast-check'

/**
 * Feature: multi-chain-support, Property 3: API Unsupported Chain Rejection
 *
 * For any chain ID that is NOT in the supported set {84532, 8453, 10, 42161},
 * the TX API must return HTTP 400 with error message "Unsupported chain".
 *
 * **Validates: Requirements 2.3**
 */

// --- Mocks ---

// Mock rate limiter so property tests don't hit limits
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: () => ({ allowed: true, retryAfter: 0 }),
  }),
}))

// Mock DB as not configured — we only care about chain validation
vi.mock('@/lib/db', () => ({
  isDatabaseConfigured: () => false,
  getDb: () => {
    throw new Error('DB not configured')
  },
  db: new Proxy(
    {},
    {
      get() {
        throw new Error('DB not configured')
      },
    },
  ),
}))

// Mock tx-cache to avoid DB calls
vi.mock('@/lib/tx-cache', () => ({
  getCachedTransactions: vi.fn().mockResolvedValue(null),
  upsertTransactions: vi.fn().mockResolvedValue(undefined),
  cleanupStaleTransactions: vi.fn().mockResolvedValue(undefined),
}))

// --- Supported chain IDs (from chainRegistry) ---
const SUPPORTED_CHAIN_IDS = new Set([84532, 8453, 10, 42161])

// --- Arbitraries ---

// Generate chain IDs that are NOT in the supported set
const unsupportedChainIdArb = fc
  .integer({ min: 1, max: 1_000_000 })
  .filter((id) => !SUPPORTED_CHAIN_IDS.has(id))

// Valid Ethereum address for the route param
const VALID_ADDRESS = '0x' + 'a'.repeat(40)

// --- Tests ---

describe('Feature: multi-chain-support, Property 3: API Unsupported Chain Rejection', () => {
  let GET: typeof import('../[address]/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../[address]/route')
    GET = mod.GET
  })

  /**
   * For any chain ID not in {84532, 8453, 10, 42161},
   * the TX API returns HTTP 400 with { error: "Unsupported chain" }.
   *
   * **Validates: Requirements 2.3**
   */
  it('rejects unsupported chain IDs with HTTP 400 and "Unsupported chain" error', async () => {
    await fc.assert(
      fc.asyncProperty(unsupportedChainIdArb, async (chainId) => {
        const url = `http://localhost:3000/api/tx/${VALID_ADDRESS}?chainId=${chainId}`
        const req = new NextRequest(url)
        const res = await GET(req, {
          params: Promise.resolve({ address: VALID_ADDRESS }),
        })

        expect(res.status).toBe(400)

        const json = await res.json()
        expect(json.error).toBe('Unsupported chain')
      }),
      { numRuns: 100 },
    )
  })
})


/**
 * Feature: multi-chain-support, Property 4: API Chain ID Passthrough
 *
 * For any supported chain ID (from chainRegistry), when sent as `chainId`
 * query parameter to the TX API, the API must use that chain ID in every
 * Etherscan V2 API request (the `chainid` URL param must match).
 *
 * **Validates: Requirements 2.1, 2.4**
 */

// Arbitrary: pick from the supported chain ID set
const supportedChainIdArb = fc.constantFrom(84532, 8453, 10, 42161)

describe('Feature: multi-chain-support, Property 4: API Chain ID Passthrough', () => {
  let GET: typeof import('../[address]/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('../[address]/route')
    GET = mod.GET
  })

  /**
   * For any supported chain ID, every Etherscan API call made by the
   * TX API must include `chainid={chainId}` in the URL.
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it('passes the chainId to all Etherscan API calls as the chainid URL parameter', async () => {
    await fc.assert(
      fc.asyncProperty(supportedChainIdArb, async (chainId) => {
        // Collect all fetch URLs
        const capturedUrls: string[] = []

        const mockFetch = vi.fn().mockImplementation((url: string) => {
          capturedUrls.push(url)
          return Promise.resolve({
            json: () => Promise.resolve({ status: '0', result: [], message: 'No transactions found' }),
          })
        })

        vi.stubGlobal('fetch', mockFetch)

        const url = `http://localhost:3000/api/tx/${VALID_ADDRESS}?chainId=${chainId}`
        const req = new NextRequest(url)
        const res = await GET(req, {
          params: Promise.resolve({ address: VALID_ADDRESS }),
        })

        // Should succeed (not 400) since chain is supported
        expect(res.status).not.toBe(400)

        // The TX API makes 3 Etherscan calls (txlist, txlistinternal, tokentx)
        expect(capturedUrls.length).toBe(3)

        // Every captured URL must contain chainid={chainId}
        for (const fetchedUrl of capturedUrls) {
          const parsed = new URL(fetchedUrl)
          expect(parsed.searchParams.get('chainid')).toBe(String(chainId))
        }

        vi.unstubAllGlobals()
      }),
      { numRuns: 100 },
    )
  })
})


/**
 * Feature: multi-chain-support, Property 5: Transaction Cache Isolation by Chain
 *
 * For any address and two distinct chain IDs, transactions cached for chain A
 * must NOT be returned when querying with chain B. The TX API uses chainId as
 * part of the cache key, so each chain's data is isolated.
 *
 * We test this at the API route level: configure the DB path (isDatabaseConfigured = true),
 * set getCachedTransactions to return data only for a specific chainId, and verify
 * that querying with a different chainId does NOT return that cached data.
 *
 * **Validates: Requirements 2.5**
 */

// Arbitrary: pair of distinct supported chain IDs
const distinctChainPairArb = fc
  .tuple(
    fc.constantFrom(84532, 8453, 10, 42161),
    fc.constantFrom(84532, 8453, 10, 42161),
  )
  .filter(([a, b]) => a !== b)

describe('Feature: multi-chain-support, Property 5: Transaction Cache Isolation by Chain', () => {
  let GET: typeof import('../[address]/route').GET
  let getCachedTransactionsMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Override isDatabaseConfigured to true so the DB cache path is exercised
    vi.doMock('@/lib/db', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => {
        throw new Error('DB not configured')
      },
      db: new Proxy(
        {},
        {
          get() {
            throw new Error('DB not configured')
          },
        },
      ),
    }))

    // Create a fresh getCachedTransactions mock that we can configure per-test
    getCachedTransactionsMock = vi.fn().mockResolvedValue(null)

    vi.doMock('@/lib/tx-cache', () => ({
      getCachedTransactions: getCachedTransactionsMock,
      upsertTransactions: vi.fn().mockResolvedValue(undefined),
      cleanupStaleTransactions: vi.fn().mockResolvedValue(undefined),
    }))

    const mod = await import('../[address]/route')
    GET = mod.GET
  })

  /**
   * For any pair of distinct supported chain IDs (chainA, chainB),
   * when cache holds transactions for chainA, querying with chainB
   * must NOT return chainA's cached transactions.
   *
   * **Validates: Requirements 2.5**
   */
  it('does not leak cached transactions from chain A when querying chain B', async () => {
    await fc.assert(
      fc.asyncProperty(distinctChainPairArb, async ([chainA, chainB]) => {
        // Fake cached transactions for chain A
        const chainATxs = [
          {
            hash: '0x' + 'f'.repeat(64),
            from: '0x' + '1'.repeat(40),
            to: VALID_ADDRESS,
            value: '1000000000000000000',
            timeStamp: '1700000000',
            isError: '0',
            direction: 'in' as const,
          },
        ]

        // getCachedTransactions returns data ONLY when called with chainA
        getCachedTransactionsMock.mockImplementation(
          (addr: string, chainId: number) => {
            if (chainId === chainA) return Promise.resolve(chainATxs)
            return Promise.resolve(null)
          },
        )

        // Stub fetch for chain B's Etherscan calls (cache miss → fetches from API)
        const mockFetch = vi.fn().mockImplementation(() =>
          Promise.resolve({
            json: () =>
              Promise.resolve({
                status: '0',
                result: [],
                message: 'No transactions found',
              }),
          }),
        )
        vi.stubGlobal('fetch', mockFetch)

        // --- Query chain A: should get cached data ---
        const reqA = new NextRequest(
          `http://localhost:3000/api/tx/${VALID_ADDRESS}?chainId=${chainA}`,
        )
        const resA = await GET(reqA, {
          params: Promise.resolve({ address: VALID_ADDRESS }),
        })
        const jsonA = await resA.json()

        expect(resA.status).toBe(200)
        expect(jsonA.transactions).toEqual(chainATxs)

        // --- Query chain B: should NOT get chain A's cached data ---
        const reqB = new NextRequest(
          `http://localhost:3000/api/tx/${VALID_ADDRESS}?chainId=${chainB}`,
        )
        const resB = await GET(reqB, {
          params: Promise.resolve({ address: VALID_ADDRESS }),
        })
        const jsonB = await resB.json()

        expect(resB.status).toBe(200)

        // Chain B's response must not contain chain A's cached transactions
        const chainBHashes = (jsonB.transactions ?? []).map(
          (tx: { hash: string }) => tx.hash,
        )
        for (const tx of chainATxs) {
          expect(chainBHashes).not.toContain(tx.hash)
        }

        // Verify getCachedTransactions was called with the correct chainId each time
        const calls = getCachedTransactionsMock.mock.calls
        const chainIds = calls.map((c: unknown[]) => c[1])
        expect(chainIds).toContain(chainA)
        expect(chainIds).toContain(chainB)

        vi.unstubAllGlobals()
      }),
      { numRuns: 50 },
    )
  })
})
