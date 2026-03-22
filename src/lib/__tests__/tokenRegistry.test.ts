import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getTokensForChain, getToken } from '../tokenRegistry'
import { getSupportedChains, getChain } from '../chainRegistry'

// Task 4.1 - Unit tests
// Requirements: 2.2, 2.7
describe('Token Registry - unit tests', () => {
  it('USDC exists on Base Sepolia (84532) with correct address', () => {
    const token = getToken(84532, 'USDC')
    expect(token).toBeDefined()
    expect(token!.address).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e')
  })

  it('cbBTC exists on Base Mainnet (8453)', () => {
    const token = getToken(8453, 'cbBTC')
    expect(token).toBeDefined()
    expect(token!.symbol).toBe('cbBTC')
  })

  it('cbBTC does NOT exist on Optimism (10)', () => {
    expect(getToken(10, 'cbBTC')).toBeUndefined()
  })

  it('cbBTC does NOT exist on Arbitrum (42161)', () => {
    expect(getToken(42161, 'cbBTC')).toBeUndefined()
  })

  it('getToken returns undefined for unknown symbol on Base Sepolia', () => {
    expect(getToken(84532, 'UNKNOWN')).toBeUndefined()
  })

  it('getTokensForChain returns [] for unknown chainId 999999', () => {
    expect(getTokensForChain(999999)).toEqual([])
  })
})

// Task 4.2 - Property 3: Token Registry Completeness
// Feature: token-chain-expansion, Property 3: Token Registry Completeness
// Validates: Requirements 2.1
describe('Property 3: Token Registry Completeness', () => {
  it('every token from getTokensForChain() has all required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getSupportedChains().map((c) => c.chainId)).chain((chainId) =>
          fc.tuple(
            fc.constant(chainId),
            fc.constantFrom(...getTokensForChain(chainId)),
          ),
        ),
        ([, token]) => {
          expect(typeof token.symbol).toBe('string')
          expect(token.symbol.length).toBeGreaterThan(0)
          expect(typeof token.name).toBe('string')
          expect(token.name.length).toBeGreaterThan(0)
          expect(typeof token.address).toBe('string')
          expect(
            token.address === 'native' || token.address.startsWith('0x'),
          ).toBe(true)
          expect(typeof token.decimals).toBe('number')
          expect(typeof token.logoUrl).toBe('string')
          expect(token.logoUrl.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Task 4.3 - Property 4: Token Registry Lookup Round-Trip
// Feature: token-chain-expansion, Property 4: Token Registry Lookup Round-Trip
// Validates: Requirements 2.3, 2.7
describe('Property 4: Token Registry Lookup Round-Trip', () => {
  it('getToken returns matching symbol for valid (chainId, symbol) pairs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getSupportedChains().map((c) => c.chainId)).chain((chainId) =>
          fc.tuple(
            fc.constant(chainId),
            fc.constantFrom(...getTokensForChain(chainId).map((t) => t.symbol)),
          ),
        ),
        ([chainId, symbol]) => {
          const token = getToken(chainId, symbol)
          expect(token).toBeDefined()
          expect(token!.symbol).toBe(symbol)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('getToken returns undefined for (chainId, symbol) pairs not in registry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getSupportedChains().map((c) => c.chainId)).chain((chainId) =>
          fc.tuple(
            fc.constant(chainId),
            fc.string().filter(
              (s) => !getTokensForChain(chainId).some((t) => t.symbol === s),
            ),
          ),
        ),
        ([chainId, symbol]) => {
          expect(() => getToken(chainId, symbol)).not.toThrow()
          expect(getToken(chainId, symbol)).toBeUndefined()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Task 4.4 - Property 5: ETH Always Available on Supported Chains
// Feature: token-chain-expansion, Property 5: ETH Always Available on Supported Chains
// Validates: Requirements 2.8
describe('Property 5: ETH Always Available on Supported Chains', () => {
  it('every supported chain has ETH with address native', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getSupportedChains().map((c) => c.chainId)),
        (chainId) => {
          const tokens = getTokensForChain(chainId)
          const eth = tokens.find((t) => t.symbol === 'ETH')
          expect(eth).toBeDefined()
          expect(eth!.address).toBe('native')
        },
      ),
      { numRuns: 100 },
    )
  })
})
