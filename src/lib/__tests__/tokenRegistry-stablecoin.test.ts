import { describe, it, expect } from 'vitest'
import { getTokensForChain, getToken, getDefaultToken } from '@/lib/tokenRegistry'

// Task 5.1 — Unit tests for stablecoin-first UX
// Validates: Requirements 4.1, 4.2, 4.3, 5.1

const supportedChainIds = [84532, 8453, 10, 42161]

describe('Contract address regression', () => {
  it('USDC on Base Sepolia (84532) has correct address', () => {
    const token = getToken(84532, 'USDC')
    expect(token).toBeDefined()
    expect(token!.address).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e')
  })

  it('USDC on Base Mainnet (8453) has correct address', () => {
    const token = getToken(8453, 'USDC')
    expect(token).toBeDefined()
    expect(token!.address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
  })

  it('ETH on any chain has address "native"', () => {
    for (const chainId of supportedChainIds) {
      const token = getToken(chainId, 'ETH')
      expect(token).toBeDefined()
      expect(token!.address).toBe('native')
    }
  })
})

describe('getDefaultToken concrete examples', () => {
  it('getDefaultToken(84532) returns USDC', () => {
    expect(getDefaultToken(84532)).toBe('USDC')
  })

  it('getDefaultToken(8453) returns USDC', () => {
    expect(getDefaultToken(8453)).toBe('USDC')
  })
})

describe('ETH exists in every supported chain', () => {
  it.each(supportedChainIds)('ETH exists on chain %i', (chainId) => {
    const token = getToken(chainId, 'ETH')
    expect(token).toBeDefined()
    expect(token!.symbol).toBe('ETH')
  })
})
