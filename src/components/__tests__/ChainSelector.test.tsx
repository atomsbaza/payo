// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { getSupportedChains, SupportedChain } from '@/lib/chainRegistry'

// --- Mocks ---

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: {
      labelChain: 'Network',
      testnetBadge: 'Testnet',
    },
    toggleLang: () => {},
  }),
}))

import { ChainSelector } from '../ChainSelector'

// ─────────────────────────────────────────────
// Task 11.1 — Unit Tests
// ─────────────────────────────────────────────

describe('ChainSelector — Unit Tests', () => {
  const chains = getSupportedChains()

  it('renders a button for all 4 supported chains', () => {
    const { getByText } = render(
      <ChainSelector value={84532} onChange={() => {}} />
    )
    expect(getByText('Base Sepolia')).toBeTruthy()
    expect(getByText('Base Mainnet')).toBeTruthy()
    expect(getByText('Optimism')).toBeTruthy()
    expect(getByText('Arbitrum One')).toBeTruthy()
  })

  it('shows "Testnet" badge ONLY for Base Sepolia (chainId 84532, isTestnet: true)', () => {
    const { getAllByText, queryAllByText } = render(
      <ChainSelector value={84532} onChange={() => {}} />
    )
    // Exactly one "Testnet" badge
    const badges = getAllByText('Testnet')
    expect(badges).toHaveLength(1)

    // The badge is inside the Base Sepolia button
    const badge = badges[0]
    const button = badge.closest('button')
    expect(button?.textContent).toContain('Base Sepolia')
  })

  it('calls onChange with correct chainId when a chain button is clicked', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <ChainSelector value={84532} onChange={onChange} />
    )

    fireEvent.click(getByText('Base Mainnet').closest('button')!)
    expect(onChange).toHaveBeenCalledWith(8453)

    fireEvent.click(getByText('Optimism').closest('button')!)
    expect(onChange).toHaveBeenCalledWith(10)

    fireEvent.click(getByText('Arbitrum One').closest('button')!)
    expect(onChange).toHaveBeenCalledWith(42161)

    fireEvent.click(getByText('Base Sepolia').closest('button')!)
    expect(onChange).toHaveBeenCalledWith(84532)
  })
})

// ─────────────────────────────────────────────
// Task 11.2 — Property 9: ChainSelector Renders All Supported Chains
// ─────────────────────────────────────────────

// Feature: token-chain-expansion, Property 9: ChainSelector Renders All Supported Chains
describe('ChainSelector — Property 9: ChainSelector Renders All Supported Chains', () => {
  /**
   * **Validates: Requirements 4.1, 4.3, 4.4**
   *
   * For any set of supported chains from getSupportedChains(), the rendered
   * ChainSelector must contain a button for every chain in the list, and
   * chains with isTestnet: true must display a "Testnet" badge.
   */
  it('renders a button for every chain in registry and shows Testnet badge for testnet chains', () => {
    const chains = getSupportedChains()
    const chainIdArb = fc.constantFrom(...chains.map(c => c.chainId))

    fc.assert(
      fc.property(chainIdArb, (selectedChainId) => {
        cleanup()
        const { container } = render(
          <ChainSelector value={selectedChainId} onChange={() => {}} />
        )

        const buttons = container.querySelectorAll('button')
        // One button per chain
        expect(buttons.length).toBe(chains.length)

        // Every chain name appears
        for (const chain of chains) {
          const btn = Array.from(buttons).find(b => b.textContent?.includes(chain.name))
          expect(btn).toBeTruthy()

          // Testnet badge presence
          if (chain.isTestnet) {
            expect(btn?.textContent).toContain('Testnet')
          } else {
            expect(btn?.textContent).not.toContain('Testnet')
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────
// Task 11.3 — Property 10: ChainSelector Calls onChange with Correct ChainId
// ─────────────────────────────────────────────

// Feature: token-chain-expansion, Property 10: ChainSelector Calls onChange with Correct ChainId
describe('ChainSelector — Property 10: ChainSelector Calls onChange with Correct ChainId', () => {
  /**
   * **Validates: Requirements 4.2**
   *
   * For any chain in the registry, clicking that chain's button in
   * ChainSelector must invoke the onChange callback with exactly that
   * chain's chainId as a number.
   */
  it('clicking any chain button invokes onChange with that chain chainId as a number', () => {
    const chains = getSupportedChains()
    const chainArb = fc.constantFrom(...chains)

    fc.assert(
      fc.property(chainArb, (targetChain: SupportedChain) => {
        cleanup()
        const onChange = vi.fn()

        const { container } = render(
          <ChainSelector value={chains[0].chainId} onChange={onChange} />
        )

        const buttons = container.querySelectorAll('button')
        const btn = Array.from(buttons).find(b => b.textContent?.includes(targetChain.name))
        expect(btn).toBeTruthy()

        fireEvent.click(btn!)

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith(targetChain.chainId)
        expect(typeof onChange.mock.calls[0][0]).toBe('number')
      }),
      { numRuns: 100 }
    )
  })
})
