import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateTransferLink } from '../validate'
import { getSupportedChains, getChain } from '../chainRegistry'
import { getTokensForChain, getToken } from '../tokenRegistry'

// Arbitrary: valid Ethereum address
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const supportedChainIds = getSupportedChains().map(c => c.chainId)

// Arbitrary: valid (chainId, token) pair from registry
const validChainTokenArb = fc
  .constantFrom(...supportedChainIds)
  .chain((chainId) =>
    fc.tuple(
      fc.constant(chainId),
      fc.constantFrom(...getTokensForChain(chainId).map(t => t.symbol))
    )
  )

// Arbitrary: valid PaymentLinkData
const validPaymentLinkArb = validChainTokenArb.chain(([chainId, token]) =>
  fc.record({
    address: ethAddressArb,
    token: fc.constant(token),
    amount: fc.oneof(
      fc.constant(''),
      fc.double({ min: 0.01, max: 1_000_000, noNaN: true }).map((n) => n.toString())
    ),
    memo: fc.string({ maxLength: 200 }),
    chainId: fc.constant(chainId),
  })
)

describe('validatePaymentLink', () => {
  // Feature: token-chain-expansion, Property 6: Validator Round-Trip with Registry
  it('all valid (chainId, symbol) pairs from registry pass validation', () => {
    fc.assert(
      fc.property(validPaymentLinkArb, (data) => {
        const result = validateTransferLink(data)
        expect(result.valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  describe('should reject invalid data with reason', () => {
    it('rejects invalid address', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^0x[a-fA-F0-9]{40}$/.test(s)),
          (badAddress) => {
            const result = validateTransferLink({
              address: badAddress,
              token: 'ETH',
              amount: '1',
              memo: '',
              chainId: 84532,
            })
            expect(result.valid).toBe(false)
            if (!result.valid) expect(result.reason).toBeTruthy()
          }
        ),
        { numRuns: 100 }
      )
    })

    // Feature: token-chain-expansion, Property 7: Validator Rejects Invalid Token for Chain
    it('rejects token not supported on chain', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...supportedChainIds).chain((chainId) =>
            fc.tuple(
              fc.constant(chainId),
              fc.string().filter((s) => !getToken(chainId, s))
            )
          ),
          ([chainId, badToken]) => {
            const result = validateTransferLink({
              address: '0x' + 'a'.repeat(40),
              token: badToken,
              amount: '1',
              memo: '',
              chainId,
            })
            expect(result.valid).toBe(false)
            if (!result.valid) {
              expect(result.reason).toBe('Token not supported on this chain')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects invalid amount', () => {
      const invalidAmounts = ['abc', '-1', '0', '1000001', 'NaN']
      for (const amount of invalidAmounts) {
        const result = validateTransferLink({
          address: '0x' + 'a'.repeat(40),
          token: 'ETH',
          amount,
          memo: '',
          chainId: 84532,
        })
        expect(result.valid).toBe(false)
        if (!result.valid) expect(result.reason).toBeTruthy()
      }
    })

    // Feature: token-chain-expansion, Property 8: Validator Rejects Unknown Chain
    it('rejects unsupported chainId', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }).filter((n) => !getChain(n)),
          (badChainId) => {
            const result = validateTransferLink({
              address: '0x' + 'a'.repeat(40),
              token: 'ETH',
              amount: '1',
              memo: '',
              chainId: badChainId,
            })
            expect(result.valid).toBe(false)
            if (!result.valid) expect(result.reason).toBe('Unsupported chain')
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('unit tests: multi-chain specific cases', () => {
    it('accepts ETH on Base Sepolia (existing valid case)', () => {
      const result = validateTransferLink({
        address: '0x' + 'a'.repeat(40),
        token: 'ETH',
        amount: '1',
        memo: '',
        chainId: 84532,
      })
      expect(result.valid).toBe(true)
    })

    it('accepts ETH on all supported chains', () => {
      for (const chainId of supportedChainIds) {
        const result = validateTransferLink({
          address: '0x' + 'a'.repeat(40),
          token: 'ETH',
          amount: '1',
          memo: '',
          chainId,
        })
        expect(result.valid).toBe(true)
      }
    })

    it('rejects unsupported chainId 999999 with HTTP 400 reason', () => {
      const result = validateTransferLink({
        address: '0x' + 'a'.repeat(40),
        token: 'ETH',
        amount: '1',
        memo: '',
        chainId: 999999,
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toBe('Unsupported chain')
    })

    it('rejects cbBTC on Optimism (token not on chain)', () => {
      const result = validateTransferLink({
        address: '0x' + 'a'.repeat(40),
        token: 'cbBTC',
        amount: '1',
        memo: '',
        chainId: 10,
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toBe('Token not supported on this chain')
    })

    it('rejects USDT on Base Sepolia (testnet)', () => {
      const result = validateTransferLink({
        address: '0x' + 'a'.repeat(40),
        token: 'USDT',
        amount: '1',
        memo: '',
        chainId: 84532,
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toBe('Token not supported on this chain')
    })

    it('accepts USDT on Base Mainnet', () => {
      const result = validateTransferLink({
        address: '0x' + 'a'.repeat(40),
        token: 'USDT',
        amount: '1',
        memo: '',
        chainId: 8453,
      })
      expect(result.valid).toBe(true)
    })
  })
})
