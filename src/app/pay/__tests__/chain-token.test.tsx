// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { render, screen, cleanup } from '@testing-library/react'
import { getChain, getSupportedChains } from '@/lib/chainRegistry'
import { getToken, getTokensForChain } from '@/lib/tokenRegistry'
import { translations } from '@/lib/i18n'

// --- Mocks ---

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: translations.en,
    toggleLang: () => {},
  }),
}))

let mockWalletChainId = 1 // default: wrong chain

vi.mock('wagmi', () => ({
  useChainId: () => mockWalletChainId,
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}))

import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'

// --- Generators ---

const supportedChainIdArb = fc.constantFrom(...getSupportedChains().map(c => c.chainId))

const validTokenPairArb = supportedChainIdArb.chain(
  (chainId) => fc.tuple(
    fc.constant(chainId),
    fc.constantFrom(...getTokensForChain(chainId).map(t => t.symbol))
  )
)

// --- Unit Tests (Task 20.1) ---

describe('Pay Page — Unit Tests: Chain and Token Display', () => {
  /**
   * Validates: Requirements 7.1, 7.3
   */

  it('getChain(8453) returns "Base Mainnet"', () => {
    const chain = getChain(8453)
    expect(chain).toBeDefined()
    expect(chain?.name).toBe('Base Mainnet')
  })

  it('getChain(84532) returns "Base Sepolia"', () => {
    const chain = getChain(84532)
    expect(chain).toBeDefined()
    expect(chain?.name).toBe('Base Sepolia')
  })

  it('getChain(10) returns "Optimism"', () => {
    const chain = getChain(10)
    expect(chain?.name).toBe('Optimism')
  })

  it('getChain(42161) returns "Arbitrum One"', () => {
    const chain = getChain(42161)
    expect(chain?.name).toBe('Arbitrum One')
  })

  it('WrongNetworkBanner shows correct chain name when wallet is on wrong chain', () => {
    mockWalletChainId = 1 // wrong chain
    render(<WrongNetworkBanner expectedChainId={8453} />)
    expect(screen.getByText(/Base Mainnet/)).toBeTruthy()
    cleanup()
  })

  it('WrongNetworkBanner shows Base Sepolia name when expected is 84532', () => {
    mockWalletChainId = 1 // wrong chain
    render(<WrongNetworkBanner expectedChainId={84532} />)
    expect(screen.getByText(/Base Sepolia/)).toBeTruthy()
    cleanup()
  })

  it('WrongNetworkBanner renders nothing when wallet is on correct chain', () => {
    mockWalletChainId = 8453
    const { container } = render(<WrongNetworkBanner expectedChainId={8453} />)
    expect(container.firstChild).toBeNull()
    cleanup()
  })
})

// --- Property 14: Pay Page Displays Correct Chain Name from Registry (Task 20.2) ---

// Feature: token-chain-expansion, Property 14: Pay Page Displays Correct Chain Name from Registry
describe('Pay Page — Property 14: Pay Page Displays Correct Chain Name from Registry', () => {
  /**
   * **Validates: Requirements 7.1, 7.4**
   *
   * For any supported chainId, `getChain(chainId)?.name` equals the expected chain name.
   * This is a registry-level property test (testing the registry function used by the Pay Page).
   */
  it('getChain(chainId)?.name returns the correct chain name for any supported chainId', () => {
    fc.assert(
      fc.property(supportedChainIdArb, (chainId) => {
        const chain = getChain(chainId)
        // Chain must be defined for any supported chainId
        expect(chain).toBeDefined()
        // Name must be a non-empty string
        expect(typeof chain?.name).toBe('string')
        expect(chain!.name.length).toBeGreaterThan(0)
        // Round-trip: looking up by chainId returns the same chainId
        expect(chain!.chainId).toBe(chainId)
        // blockExplorerUrl must be a valid URL string
        expect(chain!.blockExplorerUrl).toMatch(/^https?:\/\//)
      }),
      { numRuns: 100 }
    )
  })
})

// --- Property 15: Pay Page Uses Correct Token Config from Registry (Task 20.3) ---

// Feature: token-chain-expansion, Property 15: Pay Page Uses Correct Token Config from Registry
describe('Pay Page — Property 15: Pay Page Uses Correct Token Config from Registry', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any (chainId, token) pair, `getToken(chainId, token)` returns the correct config.
   * This is a registry-level property test (testing the registry function used by the Pay Page).
   */
  it('getToken(chainId, symbol) returns correct config for any valid (chainId, token) pair', () => {
    fc.assert(
      fc.property(validTokenPairArb, ([chainId, symbol]) => {
        const token = getToken(chainId, symbol)
        // Token must be defined for any valid pair
        expect(token).toBeDefined()
        // Symbol must match
        expect(token!.symbol).toBe(symbol)
        // Must have required fields
        expect(typeof token!.name).toBe('string')
        expect(token!.name.length).toBeGreaterThan(0)
        expect(typeof token!.decimals).toBe('number')
        expect(token!.decimals).toBeGreaterThan(0)
        expect(typeof token!.address).toBe('string')
        expect(typeof token!.logoUrl).toBe('string')
        // Address must be 'native' or a 0x hex string
        const isNative = token!.address === 'native'
        const isHex = /^0x[0-9a-fA-F]{40}$/.test(token!.address)
        expect(isNative || isHex).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})

// --- Property 16: WrongNetworkBanner Shows Correct Expected Chain Name (Task 20.4) ---

// Feature: token-chain-expansion, Property 16: WrongNetworkBanner Shows Correct Expected Chain Name
describe('WrongNetworkBanner — Property 16: WrongNetworkBanner Shows Correct Expected Chain Name', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any supported chainId, when wallet is on a different chain,
   * WrongNetworkBanner displays `getChain(chainId)?.name`.
   */
  beforeEach(() => {
    cleanup()
  })

  it('displays getChain(chainId)?.name when wallet is on a different chain', () => {
    fc.assert(
      fc.property(supportedChainIdArb, (expectedChainId) => {
        cleanup()
        // Set wallet to a different chain (use chainId + 1 to guarantee mismatch)
        mockWalletChainId = expectedChainId + 1

        const expectedName = getChain(expectedChainId)?.name ?? String(expectedChainId)

        render(<WrongNetworkBanner expectedChainId={expectedChainId} />)

        // The banner should display the expected chain name
        const banner = screen.queryByText(new RegExp(expectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        expect(banner).not.toBeNull()

        cleanup()
      }),
      { numRuns: 100 }
    )
  })
})
