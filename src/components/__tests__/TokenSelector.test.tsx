// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup, act } from '@testing-library/react'
import { getSupportedChains, getChain } from '@/lib/chainRegistry'
import { getTokensForChain, getToken } from '@/lib/tokenRegistry'

import { TokenSelector } from '../TokenSelector'

// ─────────────────────────────────────────────
// Task 13.1 — Unit Tests
// ─────────────────────────────────────────────

describe('TokenSelector — Unit Tests', () => {
  it('renders only ETH and USDC for Base Sepolia (chainId 84532)', () => {
    const { container } = render(
      <TokenSelector value="ETH" onChange={() => {}} chainId={84532} />
    )
    const buttons = container.querySelectorAll('button')
    const symbols = Array.from(buttons).map(b => b.textContent)

    expect(symbols.some(s => s?.includes('ETH'))).toBe(true)
    expect(symbols.some(s => s?.includes('USDC'))).toBe(true)
    expect(symbols.some(s => s?.includes('USDT'))).toBe(false)
    expect(symbols.some(s => s?.includes('DAI'))).toBe(false)
    expect(symbols.some(s => s?.includes('cbBTC'))).toBe(false)
    expect(buttons).toHaveLength(2)
  })

  it('renders ETH, USDC, USDT, DAI, cbBTC for Base Mainnet (chainId 8453)', () => {
    const { container } = render(
      <TokenSelector value="ETH" onChange={() => {}} chainId={8453} />
    )
    const buttons = container.querySelectorAll('button')
    const symbols = Array.from(buttons).map(b => b.textContent)

    expect(symbols.some(s => s?.includes('ETH'))).toBe(true)
    expect(symbols.some(s => s?.includes('USDC'))).toBe(true)
    expect(symbols.some(s => s?.includes('USDT'))).toBe(true)
    expect(symbols.some(s => s?.includes('DAI'))).toBe(true)
    expect(symbols.some(s => s?.includes('cbBTC'))).toBe(true)
    expect(buttons).toHaveLength(5)
  })

  it('auto-resets to ETH when chain changes and selected token is unavailable', () => {
    // USDT exists on Base Mainnet (8453) but NOT on Base Sepolia (84532)
    const onChange = vi.fn()
    const { rerender } = render(
      <TokenSelector value="USDT" onChange={onChange} chainId={8453} />
    )

    // Switch to Base Sepolia — USDT is not available there
    act(() => {
      rerender(<TokenSelector value="USDT" onChange={onChange} chainId={84532} />)
    })

    expect(onChange).toHaveBeenCalledWith('ETH')
  })

  it('does NOT reset when chain changes and selected token is still available', () => {
    // USDC exists on both Base Mainnet and Base Sepolia
    const onChange = vi.fn()
    const { rerender } = render(
      <TokenSelector value="USDC" onChange={onChange} chainId={8453} />
    )

    act(() => {
      rerender(<TokenSelector value="USDC" onChange={onChange} chainId={84532} />)
    })

    expect(onChange).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
// Task 13.2 — Property 11: TokenSelector Shows Only Chain-Appropriate Tokens
// ─────────────────────────────────────────────

// Feature: token-chain-expansion, Property 11: TokenSelector Shows Only Chain-Appropriate Tokens
describe('TokenSelector — Property 11: TokenSelector Shows Only Chain-Appropriate Tokens', () => {
  /**
   * **Validates: Requirements 5.2, 5.4**
   *
   * For any chainId passed as prop to TokenSelector, the rendered component
   * must display exactly the tokens returned by getTokensForChain(chainId) —
   * no more, no less — including each token's symbol and name.
   */
  it('rendered tokens match exactly getTokensForChain(chainId) for any supported chainId', () => {
    const chains = getSupportedChains()
    const chainIdArb = fc.constantFrom(...chains.map(c => c.chainId))

    fc.assert(
      fc.property(chainIdArb, (chainId) => {
        cleanup()
        const expectedTokens = getTokensForChain(chainId)

        const { container } = render(
          <TokenSelector value="ETH" onChange={() => {}} chainId={chainId} />
        )

        const buttons = container.querySelectorAll('button')

        // Exact count matches
        expect(buttons.length).toBe(expectedTokens.length)

        // Every expected token is rendered with its symbol and name
        for (const token of expectedTokens) {
          const btn = Array.from(buttons).find(b => b.textContent?.includes(token.symbol))
          expect(btn).toBeTruthy()
          expect(btn?.textContent).toContain(token.name)
        }

        // No extra tokens are rendered
        const renderedSymbols = Array.from(buttons).map(b => {
          const span = b.querySelector('span')
          return span?.textContent
        })
        for (const symbol of renderedSymbols) {
          expect(expectedTokens.some(t => t.symbol === symbol)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────
// Task 13.3 — Property 12: Token Auto-Resets to ETH on Chain Change
// ─────────────────────────────────────────────

// Feature: token-chain-expansion, Property 12: Token Auto-Resets to ETH on Chain Change
describe('TokenSelector — Property 12: Token Auto-Resets to ETH on Chain Change', () => {
  /**
   * **Validates: Requirements 4.5, 5.3, 6.6**
   *
   * When chainId changes and current token is absent on new chain,
   * selected token becomes ETH.
   */
  it('auto-resets to ETH when chainId changes and current token is absent on new chain', () => {
    const chains = getSupportedChains()

    // Generate a (fromChainId, toChainId) pair where a token exists on fromChain but NOT on toChain
    const chainPairWithMissingTokenArb = fc.constantFrom(...chains.map(c => c.chainId))
      .chain((fromChainId) => {
        const fromTokens = getTokensForChain(fromChainId)
        // Find chains where at least one fromChain token is missing
        const validToChains = chains.filter(c => {
          if (c.chainId === fromChainId) return false
          const toTokenSymbols = getTokensForChain(c.chainId).map(t => t.symbol)
          return fromTokens.some(t => !toTokenSymbols.includes(t.symbol))
        })
        if (validToChains.length === 0) return fc.constant(null)

        return fc.constantFrom(...validToChains).chain((toChain) => {
          const toTokenSymbols = getTokensForChain(toChain.chainId).map(t => t.symbol)
          const missingTokens = fromTokens.filter(t => !toTokenSymbols.includes(t.symbol))
          return fc.constantFrom(...missingTokens).map(token => ({
            fromChainId,
            toChainId: toChain.chainId,
            tokenSymbol: token.symbol,
          }))
        })
      })
      .filter((v): v is { fromChainId: number; toChainId: number; tokenSymbol: string } => v !== null)

    fc.assert(
      fc.property(chainPairWithMissingTokenArb, ({ fromChainId, toChainId, tokenSymbol }) => {
        cleanup()
        const onChange = vi.fn()

        const { rerender } = render(
          <TokenSelector value={tokenSymbol} onChange={onChange} chainId={fromChainId} />
        )

        act(() => {
          rerender(
            <TokenSelector value={tokenSymbol} onChange={onChange} chainId={toChainId} />
          )
        })

        // onChange must have been called with 'ETH'
        expect(onChange).toHaveBeenCalledWith('ETH')
      }),
      { numRuns: 100 }
    )
  })
})
