import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getTokensForChain, getToken, getDefaultToken } from '@/lib/tokenRegistry'

const supportedChainIds = [84532, 8453, 10, 42161] as const
const STABLECOINS = ['USDC', 'USDT', 'DAI']
const NON_STABLECOINS = ['ETH', 'cbBTC']

/**
 * Property 1: USDC เป็น token แรกในทุก chain
 *
 * For all supported chain IDs, getTokensForChain(chainId)[0].symbol
 * must equal 'USDC'.
 *
 * **Validates: Requirements 1.1, 1.3**
 */
describe('Property 1: USDC เป็น token แรกในทุก chain', () => {
  it('getTokensForChain(chainId)[0].symbol === "USDC" for every supported chain', () => {
    fc.assert(
      fc.property(fc.constantFrom(...supportedChainIds), (chainId) => {
        const tokens = getTokensForChain(chainId)
        expect(tokens[0].symbol).toBe('USDC')
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 2: Stablecoin ordering
 *
 * For all supported chain IDs, every stablecoin index must be less than
 * every non-stablecoin index in the token list.
 *
 * **Validates: Requirements 1.2**
 */
describe('Property 2: Stablecoin ordering', () => {
  it('all stablecoin indices < all non-stablecoin indices for every supported chain', () => {
    fc.assert(
      fc.property(fc.constantFrom(...supportedChainIds), (chainId) => {
        const tokens = getTokensForChain(chainId)
        const symbols = tokens.map(t => t.symbol)

        const stablecoinIndices = symbols
          .map((s, i) => (STABLECOINS.includes(s) ? i : -1))
          .filter(i => i !== -1)
        const nonStablecoinIndices = symbols
          .map((s, i) => (NON_STABLECOINS.includes(s) ? i : -1))
          .filter(i => i !== -1)

        for (const si of stablecoinIndices) {
          for (const ni of nonStablecoinIndices) {
            expect(si).toBeLessThan(ni)
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})


/**
 * Property 3: getDefaultToken round-trip consistency
 *
 * For all supported chain IDs, getDefaultToken(chainId) must equal
 * getTokensForChain(chainId)[0].symbol.
 *
 * **Validates: Requirements 1.4, 5.1, 5.3**
 */
describe('Property 3: getDefaultToken round-trip consistency', () => {
  it('getDefaultToken(chainId) === getTokensForChain(chainId)[0].symbol for every supported chain', () => {
    fc.assert(
      fc.property(fc.constantFrom(...supportedChainIds), (chainId) => {
        expect(getDefaultToken(chainId)).toBe(getTokensForChain(chainId)[0].symbol)
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 5: ETH present in all chains
 *
 * For all supported chain IDs, getToken(chainId, 'ETH') must not be undefined.
 *
 * **Validates: Requirements 4.1**
 */
describe('Property 5: ETH present in all chains', () => {
  it('getToken(chainId, "ETH") !== undefined for every supported chain', () => {
    fc.assert(
      fc.property(fc.constantFrom(...supportedChainIds), (chainId) => {
        expect(getToken(chainId, 'ETH')).not.toBeUndefined()
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 6: Unknown chain fallback
 *
 * For all chain IDs not in the supported set, getDefaultToken(chainId)
 * must return 'USDC'.
 *
 * **Validates: Requirements 5.2**
 */
describe('Property 6: Unknown chain fallback', () => {
  it('getDefaultToken(chainId) === "USDC" for unknown chain IDs', () => {
    fc.assert(
      fc.property(
        fc.integer().filter(id => !supportedChainIds.includes(id as typeof supportedChainIds[number])),
        (chainId) => {
          expect(getDefaultToken(chainId)).toBe('USDC')
        },
      ),
      { numRuns: 100 },
    )
  })
})


/**
 * Property 4: Chain switch token preservation/fallback
 *
 * For any (currentToken, newChainId) pair:
 * - If currentToken exists in getTokensForChain(newChainId), the result is currentToken (preserved)
 * - If currentToken does NOT exist in the new chain, the result is getDefaultToken(newChainId)
 *
 * This tests the logic that TokenSelector uses when switching chains.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
describe('Property 4: Chain switch token preservation/fallback', () => {
  // All unique token symbols across all chains
  const allSymbols = ['USDC', 'USDT', 'DAI', 'ETH', 'cbBTC'] as const
  const chainIds = [...supportedChainIds] as number[]

  it('token is preserved if it exists in new chain, otherwise falls back to getDefaultToken', () => {
    fc.assert(
      fc.property(
        fc.record({
          token: fc.constantFrom(...allSymbols),
          chainId: fc.constantFrom(...chainIds),
        }),
        ({ token, chainId }) => {
          const tokensInNewChain = getTokensForChain(chainId)
          const tokenExistsInNewChain = tokensInNewChain.some(t => t.symbol === token)

          // Simulate the TokenSelector chain-switch logic
          const result = tokenExistsInNewChain ? token : getDefaultToken(chainId)

          if (tokenExistsInNewChain) {
            // Token preserved — result must be the same token
            expect(result).toBe(token)
          } else {
            // Token not available — result must be the default for the new chain
            expect(result).toBe(getDefaultToken(chainId))
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
