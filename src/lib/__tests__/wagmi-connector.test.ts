import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for wagmi connector configuration
 * Tests specific examples and edge cases for the embedded-wallet feature
 */

// Capture args passed to getDefaultConfig
let capturedDefaultConfigArgs: Record<string, unknown> | undefined

vi.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: (args: Record<string, unknown>) => {
    capturedDefaultConfigArgs = args
    return { _type: 'wagmi-config', ...args }
  },
}))

// Mock all wallets from @rainbow-me/rainbowkit/wallets
const mockCoinbaseWallet = Object.assign(
  (opts: Record<string, unknown>) => ({ _type: 'coinbase-wallet', ...opts }),
  { preference: undefined as string | undefined, _isMockWallet: true },
)
const mockMetaMaskWallet = vi.fn(() => ({ _type: 'metamask-wallet' }))
const mockRainbowWallet = vi.fn(() => ({ _type: 'rainbow-wallet' }))
const mockTrustWallet = vi.fn(() => ({ _type: 'trust-wallet' }))
const mockWalletConnectWallet = vi.fn(() => ({ _type: 'walletconnect-wallet' }))

vi.mock('@rainbow-me/rainbowkit/wallets', () => ({
  coinbaseWallet: mockCoinbaseWallet,
  metaMaskWallet: mockMetaMaskWallet,
  rainbowWallet: mockRainbowWallet,
  trustWallet: mockTrustWallet,
  walletConnectWallet: mockWalletConnectWallet,
}))

describe('wagmi connector unit tests', () => {
  beforeEach(() => {
    capturedDefaultConfigArgs = undefined
    mockCoinbaseWallet.preference = undefined
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('Coinbase Smart Wallet appears as a connector option in wallets config', async () => {
    const wagmiModule = await import('../wagmi')

    expect(wagmiModule.config).toBeDefined()
    expect(capturedDefaultConfigArgs).toBeDefined()

    const wallets = capturedDefaultConfigArgs!.wallets as Array<{
      groupName: string
      wallets: unknown[]
    }>
    expect(wallets).toBeDefined()
    expect(Array.isArray(wallets)).toBe(true)

    const groupWithCoinbase = wallets.find(g =>
      g.wallets.includes(mockCoinbaseWallet),
    )
    expect(groupWithCoinbase).toBeDefined()
    expect(mockCoinbaseWallet.preference).toBe('smartWalletOnly')
  })

  it("appName is 'Crypto Pay Link'", async () => {
    await import('../wagmi')
    expect(capturedDefaultConfigArgs).toBeDefined()
    expect(capturedDefaultConfigArgs!.appName).toBe('Crypto Pay Link')
  })

  it("projectId falls back to 'YOUR_PROJECT_ID' when env var is not set", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

    vi.resetModules()
    capturedDefaultConfigArgs = undefined

    await import('../wagmi')

    expect(capturedDefaultConfigArgs).toBeDefined()
    expect(capturedDefaultConfigArgs!.projectId).toBe('YOUR_PROJECT_ID')

    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = originalEnv
    }
  })

  it('module exports both config and activeChains', async () => {
    const wagmiModule = await import('../wagmi')
    expect(wagmiModule).toHaveProperty('config')
    expect(wagmiModule).toHaveProperty('activeChains')
    expect(wagmiModule.config).toBeDefined()
    expect(wagmiModule.activeChains).toBeDefined()
    expect(Array.isArray(wagmiModule.activeChains)).toBe(true)
    expect(wagmiModule.activeChains.length).toBeGreaterThan(0)
  })
})
