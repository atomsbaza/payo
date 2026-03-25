import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as fc from 'fast-check'

/**
 * Feature: multi-chain-support, Property 3: API Unsupported Chain Rejection
 *
 * For any chain ID that is NOT in the supported set {84532, 8453, 10, 42161},
 * the Fee API must return HTTP 400 with error message "Unsupported chain".
 *
 * **Validates: Requirements 3.3**
 */

// --- Mocks ---

// Mock rate limiter so property tests don't hit limits
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: () => ({ allowed: true, retryAfter: 0 }),
  }),
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
   * the Fee API returns HTTP 400 with { error: "Unsupported chain" }.
   *
   * **Validates: Requirements 3.3**
   */
  it('rejects unsupported chain IDs with HTTP 400 and "Unsupported chain" error', async () => {
    await fc.assert(
      fc.asyncProperty(unsupportedChainIdArb, async (chainId) => {
        const url = `http://localhost:3000/api/fees/${VALID_ADDRESS}?chainId=${chainId}`
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
 * query parameter to the Fee API, the API must use that chain ID in every
 * Etherscan V2 API request (the `chainid` URL param must match).
 *
 * **Validates: Requirements 3.1, 3.4**
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
   * Fee API must include `chainid={chainId}` in the URL.
   *
   * **Validates: Requirements 3.1, 3.4**
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

        const url = `http://localhost:3000/api/fees/${VALID_ADDRESS}?chainId=${chainId}`
        const req = new NextRequest(url)
        const res = await GET(req, {
          params: Promise.resolve({ address: VALID_ADDRESS }),
        })

        // Should succeed (not 400) since chain is supported
        expect(res.status).not.toBe(400)

        // The Fee API makes 3 Etherscan calls (txlistinternal, txlist, tokentx)
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
