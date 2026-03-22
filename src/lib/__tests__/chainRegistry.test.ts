import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getSupportedChains, getChain } from '../chainRegistry'

// Task 3.1 - Unit tests
// Requirements: 1.2, 1.3
describe('Chain Registry - unit tests', () => {
  it('contains all 4 supported chains', () => {
    const chains = getSupportedChains()
    expect(chains).toHaveLength(4)
  })

  it('includes Base Sepolia (84532)', () => {
    const chain = getChain(84532)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Base Sepolia')
    expect(chain!.isTestnet).toBe(true)
  })

  it('includes Base Mainnet (8453)', () => {
    const chain = getChain(8453)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Base Mainnet')
    expect(chain!.isTestnet).toBe(false)
  })

  it('includes Optimism (10)', () => {
    const chain = getChain(10)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Optimism')
  })

  it('includes Arbitrum One (42161)', () => {
    const chain = getChain(42161)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Arbitrum One')
  })

  it('returns undefined for unknown chain ID 999999', () => {
    expect(getChain(999999)).toBeUndefined()
  })

  it('returns undefined for other unknown IDs', () => {
    expect(getChain(0)).toBeUndefined()
    expect(getChain(1)).toBeUndefined()
    expect(getChain(12345)).toBeUndefined()
  })
})

// Task 3.2 - Property 1: Chain Registry Completeness
// Feature: token-chain-expansion, Property 1: Chain Registry Completeness
// Validates: Requirements 1.1
describe('Property 1: Chain Registry Completeness', () => {
  it('every chain from getSupportedChains() has all required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getSupportedChains()),
        (chain) => {
          expect(typeof chain.chainId).toBe('number')
          expect(typeof chain.name).toBe('string')
          expect(chain.name.length).toBeGreaterThan(0)
          expect(typeof chain.nativeCurrency).toBe('string')
          expect(chain.nativeCurrency.length).toBeGreaterThan(0)
          expect(typeof chain.blockExplorerUrl).toBe('string')
          expect(chain.blockExplorerUrl.length).toBeGreaterThan(0)
          expect(typeof chain.isTestnet).toBe('boolean')
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Task 3.3 - Property 2: Chain Registry Lookup Round-Trip
// Feature: token-chain-expansion, Property 2: Chain Registry Lookup Round-Trip
// Validates: Requirements 1.3
describe('Property 2: Chain Registry Lookup Round-Trip', () => {
  it('getChain(chainId) returns object with matching chainId for all supported chains', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getSupportedChains().map((c) => c.chainId)),
        (chainId) => {
          const chain = getChain(chainId)
          expect(chain).toBeDefined()
          expect(chain!.chainId).toBe(chainId)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('getChain(chainId) returns undefined for IDs not in registry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }).filter((id) => !getChain(id)),
        (chainId) => {
          expect(getChain(chainId)).toBeUndefined()
        },
      ),
      { numRuns: 100 },
    )
  })
})
