import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: embedded-wallet, Property 1: Config includes coinbaseWallet connector
 * with smartWalletOnly preference and preserves existing fields
 *
 * For any wagmi config created by getDefaultConfig, the config SHALL include a
 * coinbaseWallet connector configured with preference: 'smartWalletOnly', AND
 * the config SHALL preserve appName as 'Crypto Pay Link', ssr: true, and the
 * module SHALL export both config and activeChains.
 *
 * Validates: Requirements 1.1, 1.4, 3.2
 */

// Capture the args passed to getDefaultConfig
let capturedDefaultConfigArgs: Record<string, unknown> | undefined

// Mock RainbowKit's getDefaultConfig to capture its arguments
vi.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: (args: Record<string, unknown>) => {
    capturedDefaultConfigArgs = args
    return { _type: 'wagmi-config', ...args }
  },
}))

// Mock coinbaseWallet from @rainbow-me/rainbowkit/wallets
// RainbowKit wallet is a callable function with a .preference property
const mockCoinbaseWallet = Object.assign(
  (opts: Record<string, unknown>) => ({ _type: 'coinbase-wallet', ...opts }),
  { preference: undefined as string | undefined, _isMockWallet: true },
)
vi.mock('@rainbow-me/rainbowkit/wallets', () => ({
  coinbaseWallet: mockCoinbaseWallet,
}))

describe('Feature: embedded-wallet, Property 1: Config includes coinbaseWallet connector with smartWalletOnly preference and preserves existing fields', () => {
  beforeEach(() => {
    capturedDefaultConfigArgs = undefined
    mockCoinbaseWallet.preference = undefined
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  /**
   * Property: For any import of wagmi.ts, the module always configures
   * coinbaseWallet with smartWalletOnly preference and preserves
   * appName, ssr, and exports.
   *
   * We use fc.constant(true) as a dummy arbitrary to drive 100+ iterations,
   * re-importing the module each time to verify the invariant holds.
   *
   * Validates: Requirements 1.1, 1.4, 3.2
   */
  it('config includes coinbaseWallet with smartWalletOnly and preserves appName, ssr, and exports', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(true), async () => {
        capturedDefaultConfigArgs = undefined
        mockCoinbaseWallet.preference = undefined
        vi.resetModules()

        const wagmiModule = await import('../wagmi')

        // Requirement 3.2: module exports both config and activeChains
        expect(wagmiModule.config).toBeDefined()
        expect(wagmiModule.activeChains).toBeDefined()

        // Requirement 1.4: appName preserved as 'Crypto Pay Link'
        expect(capturedDefaultConfigArgs).toBeDefined()
        expect(capturedDefaultConfigArgs!.appName).toBe('Crypto Pay Link')

        // Requirement 1.4: ssr preserved as true
        expect(capturedDefaultConfigArgs!.ssr).toBe(true)

        // Requirement 1.1: coinbaseWallet preference set to smartWalletOnly
        expect(mockCoinbaseWallet.preference).toBe('smartWalletOnly')

        // Requirement 1.1: wallets array includes the coinbase connector group
        const wallets = capturedDefaultConfigArgs!.wallets as Array<{
          groupName: string
          wallets: unknown[]
        }>
        expect(wallets).toBeDefined()
        expect(Array.isArray(wallets)).toBe(true)
        expect(wallets.length).toBeGreaterThan(0)

        const popularGroup = wallets.find(g => g.groupName === 'Popular')
        expect(popularGroup).toBeDefined()
        expect(popularGroup!.wallets).toContain(mockCoinbaseWallet)
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: embedded-wallet, Property 2: Active chains match chain registry for any environment
describe('Feature: embedded-wallet, Property 2: Active chains match chain registry for any environment', () => {
  /**
   * Property 2: For any environment configuration (production or development),
   * the activeChains exported from wagmi.ts SHALL contain exactly the chains
   * returned by getSupportedChains() — including Base Sepolia in non-production
   * environments and excluding it in production.
   *
   * We generate a random environment value (production vs non-production) and
   * verify that activeChains chain IDs match getSupportedChains() chain IDs.
   *
   * Validates: Requirements 2.2, 4.2
   */
  const envArbitrary = fc.oneof(
    fc.constant('production'),
    fc.constant(undefined),
    fc.constant('development'),
    fc.constant(''),
  )

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_ENV
    vi.resetModules()
  })

  it('activeChains matches getSupportedChains() for any environment', async () => {
    await fc.assert(
      fc.asyncProperty(envArbitrary, async (envValue) => {
        vi.resetModules()

        // Set environment before importing modules
        if (envValue === undefined) {
          delete process.env.NEXT_PUBLIC_APP_ENV
        } else {
          process.env.NEXT_PUBLIC_APP_ENV = envValue
        }

        // Re-import both modules fresh so they pick up the env change
        const { getSupportedChains } = await import('../chainRegistry')
        const { activeChains } = await import('../wagmi')

        const registryChainIds = getSupportedChains().map(c => c.chainId)
        const activeChainIds = activeChains.map((chain: { id: number }) => chain.id)

        // activeChains must contain exactly the same chain IDs as the registry
        expect(activeChainIds.sort()).toEqual(registryChainIds.sort())

        // Requirement 4.2: non-production includes Base Sepolia (84532)
        if (envValue !== 'production') {
          expect(activeChainIds).toContain(84532)
        }

        // Requirement 2.2: production excludes testnet chains
        if (envValue === 'production') {
          expect(activeChainIds).not.toContain(84532)
        }
      }),
      { numRuns: 100 },
    )
  })
})
