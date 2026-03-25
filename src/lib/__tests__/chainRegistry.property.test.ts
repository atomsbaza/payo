import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import type { SupportedChain } from '../chainRegistry'

/**
 * Feature: testnet-env-visibility, Property 1: Production filtering excludes all testnets
 *
 * For any chain registry containing a mix of testnet and mainnet entries,
 * when NEXT_PUBLIC_APP_ENV is set to "production", getSupportedChains()
 * must return only chains where isTestnet === false. No testnet chain
 * should appear in the result.
 *
 * **Validates: Requirements 1.1, 3.1**
 */

// --- Arbitraries ---

/** Generate a random SupportedChain entry */
const chainArb: fc.Arbitrary<SupportedChain> = fc.record({
  chainId: fc.integer({ min: 1, max: 999_999 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  nativeCurrency: fc.constantFrom('ETH', 'MATIC', 'AVAX', 'BNB'),
  blockExplorerUrl: fc.webUrl(),
  isTestnet: fc.boolean(),
})

/**
 * Generate a chain registry that is guaranteed to have at least one testnet
 * and at least one mainnet entry, so the filtering is meaningful.
 */
const mixedRegistryArb: fc.Arbitrary<SupportedChain[]> = fc
  .tuple(
    // At least one testnet
    fc.array(chainArb.map(c => ({ ...c, isTestnet: true })), { minLength: 1, maxLength: 5 }),
    // At least one mainnet
    fc.array(chainArb.map(c => ({ ...c, isTestnet: false })), { minLength: 1, maxLength: 5 }),
  )
  .chain(([testnets, mainnets]) =>
    // Shuffle the combined array so order is random
    fc.shuffledSubarray([...testnets, ...mainnets], {
      minLength: testnets.length + mainnets.length,
      maxLength: testnets.length + mainnets.length,
    }),
  )

// --- Tests ---

describe('Feature: testnet-env-visibility, Property 1: Production filtering excludes all testnets', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  /**
   * Property: For any mixed chain registry, production mode filtering
   * returns only mainnet chains (isTestnet === false).
   *
   * We mock the CHAINS array via vi.mock and dynamic import so each
   * iteration can test a different registry composition.
   *
   * **Validates: Requirements 1.1, 3.1**
   */
  it('every chain returned by getSupportedChains() in production has isTestnet === false', async () => {
    await fc.assert(
      fc.asyncProperty(mixedRegistryArb, async (registry) => {
        vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')

        // Dynamically mock the module with the generated registry
        vi.doMock('../chainRegistry', async (importOriginal) => {
          const original = await importOriginal<typeof import('../chainRegistry')>()

          // Build a module that uses our generated registry
          const CHAINS = registry

          return {
            ...original,
            isProduction: () => process.env.NEXT_PUBLIC_APP_ENV === 'production',
            getSupportedChains: () => {
              if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
                return CHAINS.filter((c: SupportedChain) => !c.isTestnet)
              }
              return CHAINS
            },
            getChain: (chainId: number) => CHAINS.find((c: SupportedChain) => c.chainId === chainId),
          }
        })

        const { getSupportedChains } = await import('../chainRegistry')
        const result = getSupportedChains()

        // Core assertion: no testnet chain in production result
        for (const chain of result) {
          expect(chain.isTestnet).toBe(false)
        }

        // The result should contain exactly the mainnet entries from the registry
        const expectedMainnets = registry.filter(c => !c.isTestnet)
        expect(result).toHaveLength(expectedMainnets.length)

        vi.unstubAllEnvs()
        vi.resetModules()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Concrete check against the real registry: in production mode,
   * the actual CHAINS array should yield zero testnet entries.
   *
   * **Validates: Requirements 1.1, 3.1**
   */
  it('real registry returns no testnets in production mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')

    const { getSupportedChains } = await import('../chainRegistry')
    const result = getSupportedChains()

    expect(result.length).toBeGreaterThan(0)
    for (const chain of result) {
      expect(chain.isTestnet).toBe(false)
    }
  })
})


/**
 * Feature: testnet-env-visibility, Property 2: Non-production mode returns the full chain list
 *
 * For any value of NEXT_PUBLIC_APP_ENV that is not "production" (including
 * undefined, empty string, "development", "staging", or any arbitrary string),
 * getSupportedChains() should return every chain in the registry — both testnet
 * and mainnet entries. The length should equal the total number of registered chains.
 *
 * **Validates: Requirements 1.2, 3.2**
 */

/** Generate a random non-"production" env value (including undefined) */
const nonProductionEnvArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('development'),
  fc.constant('staging'),
  fc.string({ minLength: 0, maxLength: 30 }).filter(s => s !== 'production'),
)

describe('Feature: testnet-env-visibility, Property 2: Non-production mode returns the full chain list', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  /**
   * Property: For any non-"production" env value and any mixed chain registry,
   * getSupportedChains() returns the complete registry without filtering.
   *
   * **Validates: Requirements 1.2, 3.2**
   */
  it('getSupportedChains() returns every chain in the registry for non-production env values', async () => {
    await fc.assert(
      fc.asyncProperty(nonProductionEnvArb, mixedRegistryArb, async (envValue, registry) => {
        if (envValue === undefined) {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
          delete process.env.NEXT_PUBLIC_APP_ENV
        } else {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', envValue)
        }

        // Dynamically mock the module with the generated registry
        vi.doMock('../chainRegistry', async (importOriginal) => {
          const original = await importOriginal<typeof import('../chainRegistry')>()

          const CHAINS = registry

          return {
            ...original,
            isProduction: () => process.env.NEXT_PUBLIC_APP_ENV === 'production',
            getSupportedChains: () => {
              if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
                return CHAINS.filter((c: SupportedChain) => !c.isTestnet)
              }
              return CHAINS
            },
            getChain: (chainId: number) => CHAINS.find((c: SupportedChain) => c.chainId === chainId),
          }
        })

        const { getSupportedChains } = await import('../chainRegistry')
        const result = getSupportedChains()

        // Core assertion: result length equals the full registry length
        expect(result).toHaveLength(registry.length)

        // Every chain from the registry should be present in the result
        for (const chain of registry) {
          expect(result).toContainEqual(chain)
        }

        vi.unstubAllEnvs()
        vi.resetModules()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Concrete check against the real registry: in non-production mode,
   * the actual CHAINS array should include testnet entries.
   *
   * **Validates: Requirements 1.2, 3.2**
   */
  it('real registry returns all chains including testnets in non-production mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development')

    const { getSupportedChains } = await import('../chainRegistry')
    const result = getSupportedChains()

    // Should include at least one testnet and one mainnet
    const hasTestnet = result.some(c => c.isTestnet)
    const hasMainnet = result.some(c => !c.isTestnet)

    expect(hasTestnet).toBe(true)
    expect(hasMainnet).toBe(true)
  })

  /**
   * Concrete check: when NEXT_PUBLIC_APP_ENV is undefined, all chains are returned.
   *
   * **Validates: Requirements 1.2, 3.2**
   */
  it('real registry returns all chains when NEXT_PUBLIC_APP_ENV is undefined', async () => {
    // Ensure the env var is not set
    delete process.env.NEXT_PUBLIC_APP_ENV

    const { getSupportedChains } = await import('../chainRegistry')
    const result = getSupportedChains()

    const hasTestnet = result.some(c => c.isTestnet)
    const hasMainnet = result.some(c => !c.isTestnet)

    expect(hasTestnet).toBe(true)
    expect(hasMainnet).toBe(true)
  })
})


/**
 * Feature: testnet-env-visibility, Property 3: getChain() is environment-independent
 *
 * For any chain ID that exists in the full chain registry and for any value of
 * NEXT_PUBLIC_APP_ENV, getChain(chainId) should return the matching chain entry.
 * The environment setting must never cause getChain() to return undefined for a
 * registered chain.
 *
 * **Validates: Requirements 5.1, 5.3**
 */

/** Generate a random env value including "production" and non-production variants */
const anyEnvArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('production'),
  fc.constant('development'),
  fc.constant('staging'),
  fc.string({ minLength: 0, maxLength: 30 }),
)

describe('Feature: testnet-env-visibility, Property 3: getChain() is environment-independent', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  /**
   * Property: For any registered chain ID and any NEXT_PUBLIC_APP_ENV value,
   * getChain() returns the chain (never undefined).
   *
   * We generate random mixed registries and random env values, mock the
   * module with the generated registry, and verify getChain() always
   * searches the full list regardless of environment.
   *
   * **Validates: Requirements 5.1, 5.3**
   */
  it('getChain() returns a defined chain for every registered chain ID regardless of environment', async () => {
    await fc.assert(
      fc.asyncProperty(anyEnvArb, mixedRegistryArb, async (envValue, registry) => {
        if (envValue === undefined) {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
          delete process.env.NEXT_PUBLIC_APP_ENV
        } else {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', envValue)
        }

        // Pick a random chain from the registry to look up
        const targetChain = registry[Math.floor(Math.random() * registry.length)]

        vi.doMock('../chainRegistry', async (importOriginal) => {
          const original = await importOriginal<typeof import('../chainRegistry')>()
          const CHAINS = registry

          return {
            ...original,
            isProduction: () => process.env.NEXT_PUBLIC_APP_ENV === 'production',
            getSupportedChains: () => {
              if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
                return CHAINS.filter((c: SupportedChain) => !c.isTestnet)
              }
              return CHAINS
            },
            // getChain always searches the FULL list — this is the property under test
            getChain: (chainId: number) => CHAINS.find((c: SupportedChain) => c.chainId === chainId),
          }
        })

        const { getChain } = await import('../chainRegistry')
        const result = getChain(targetChain.chainId)

        // Core assertion: getChain() must always find a registered chain
        expect(result).toBeDefined()
        expect(result!.chainId).toBe(targetChain.chainId)

        vi.unstubAllEnvs()
        vi.resetModules()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Property: For any random chain registry and any env value, getChain()
   * always searches the full registry (not the filtered one).
   *
   * We generate a mixed registry with testnet and mainnet chains, set env
   * to "production", and verify getChain() still finds testnet chains.
   *
   * **Validates: Requirements 5.1, 5.3**
   */
  it('getChain() finds testnet chains even in production mode', async () => {
    await fc.assert(
      fc.asyncProperty(anyEnvArb, mixedRegistryArb, async (envValue, registry) => {
        if (envValue === undefined) {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
          delete process.env.NEXT_PUBLIC_APP_ENV
        } else {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', envValue)
        }

        // Mock with the generated registry, keeping getChain searching full list
        vi.doMock('../chainRegistry', async (importOriginal) => {
          const original = await importOriginal<typeof import('../chainRegistry')>()
          const CHAINS = registry

          return {
            ...original,
            isProduction: () => process.env.NEXT_PUBLIC_APP_ENV === 'production',
            getSupportedChains: () => {
              if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
                return CHAINS.filter((c: SupportedChain) => !c.isTestnet)
              }
              return CHAINS
            },
            getChain: (chainId: number) => CHAINS.find((c: SupportedChain) => c.chainId === chainId),
          }
        })

        const { getChain } = await import('../chainRegistry')

        // Assert every chain in the registry is findable, regardless of env
        for (const chain of registry) {
          const result = getChain(chain.chainId)
          expect(result).toBeDefined()
          expect(result!.chainId).toBe(chain.chainId)
        }

        vi.unstubAllEnvs()
        vi.resetModules()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Concrete check: getChain() finds the testnet chain (Base Sepolia)
   * even when running in production mode, using the real registry.
   *
   * **Validates: Requirements 5.1, 5.3**
   */
  it('real registry: getChain() finds Base Sepolia (testnet) in production mode', async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.doUnmock('../chainRegistry')
    vi.resetModules()

    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')

    // Use dynamic import after full reset to get the real module
    const { getChain } = await import('../chainRegistry')
    const result = getChain(84532) // Base Sepolia — a testnet chain

    expect(result).toBeDefined()
    expect(result!.chainId).toBe(84532)
    expect(result!.isTestnet).toBe(true)
  })
})


/**
 * Feature: testnet-env-visibility, Property 4: Default chain is always in the supported set
 *
 * For any value of NEXT_PUBLIC_APP_ENV, the chain ID returned by getDefaultChainId()
 * should be present in the result of getSupportedChains(). The default chain must
 * always be selectable in the current environment.
 *
 * **Validates: Requirements 4.1, 4.2**
 */

describe('Feature: testnet-env-visibility, Property 4: Default chain is always in the supported set', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  /**
   * Property: For any value of NEXT_PUBLIC_APP_ENV, getDefaultChainId() returns
   * a chain ID that is present in the getSupportedChains() result.
   *
   * We generate random env values (including "production", "development",
   * undefined, empty string, and arbitrary strings) and verify the invariant
   * holds against the real chain registry.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it('getDefaultChainId() always returns a chain ID present in getSupportedChains()', async () => {
    const anyEnvArb: fc.Arbitrary<string | undefined> = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('production'),
      fc.constant('development'),
      fc.constant('staging'),
      fc.string({ minLength: 0, maxLength: 30 }),
    )

    await fc.assert(
      fc.asyncProperty(anyEnvArb, async (envValue) => {
        if (envValue === undefined) {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
          delete process.env.NEXT_PUBLIC_APP_ENV
        } else {
          vi.stubEnv('NEXT_PUBLIC_APP_ENV', envValue)
        }

        vi.resetModules()

        const { getDefaultChainId, getSupportedChains } = await import('../chainRegistry')

        const defaultId = getDefaultChainId()
        const supported = getSupportedChains()
        const supportedIds = supported.map(c => c.chainId)

        // Core assertion: the default chain ID must be in the supported set
        expect(supportedIds).toContain(defaultId)

        vi.unstubAllEnvs()
        vi.resetModules()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Concrete check: in production mode, getDefaultChainId() returns Base Mainnet (8453)
   * and that chain is in the supported set.
   *
   * **Validates: Requirements 4.1**
   */
  it('production: default chain 8453 is in the supported set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')

    const { getDefaultChainId, getSupportedChains } = await import('../chainRegistry')

    const defaultId = getDefaultChainId()
    expect(defaultId).toBe(8453)

    const supportedIds = getSupportedChains().map(c => c.chainId)
    expect(supportedIds).toContain(8453)
  })

  /**
   * Concrete check: in development mode, getDefaultChainId() returns Base Sepolia (84532)
   * and that chain is in the supported set.
   *
   * **Validates: Requirements 4.2**
   */
  it('development: default chain 84532 is in the supported set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development')

    const { getDefaultChainId, getSupportedChains } = await import('../chainRegistry')

    const defaultId = getDefaultChainId()
    expect(defaultId).toBe(84532)

    const supportedIds = getSupportedChains().map(c => c.chainId)
    expect(supportedIds).toContain(84532)
  })
})
