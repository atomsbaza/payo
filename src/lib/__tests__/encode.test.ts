import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { encodePaymentLink, decodePaymentLink, type PaymentLinkData } from '../encode'
import { getSupportedChains } from '../chainRegistry'
import { getTokensForChain } from '../tokenRegistry'

// Feature: security-hardening, Property 6: Encode/decode round-trip
// Validates: Requirements 3.5

const hexCharArb = fc.constantFrom(
  ...'0123456789abcdef'.split(''),
)

const ethAddressArb = fc
  .array(hexCharArb, { minLength: 40, maxLength: 40 })
  .map((chars) => `0x${chars.join('')}`)

const tokenArb = fc.constantFrom('ETH', 'USDC')

const amountArb = fc.oneof(
  fc.constant(''),
  fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true })
    .filter((n) => n > 0)
    .map((n) => n.toString()),
)

const memoArb = fc.string({ minLength: 0, maxLength: 200 }).filter((s) => {
  // Filter out strings that break encodeURIComponent/JSON round-trip
  try {
    const json = JSON.stringify(s)
    JSON.parse(json)
    encodeURIComponent(s)
    return true
  } catch {
    return false
  }
})

const paymentLinkDataArb = fc.record({
  address: ethAddressArb,
  token: tokenArb,
  amount: amountArb,
  memo: memoArb,
  chainId: fc.constant(84532),
}) as fc.Arbitrary<PaymentLinkData>

describe('encode/decode round-trip', () => {
  it('Property 6: decoding an encoded PaymentLinkData returns equivalent data', () => {
    fc.assert(
      fc.property(paymentLinkDataArb, (data) => {
        const encoded = encodePaymentLink(data)
        const decoded = decodePaymentLink(encoded)

        expect(decoded).not.toBeNull()
        expect(decoded!.address).toBe(data.address)
        expect(decoded!.token).toBe(data.token)
        expect(decoded!.amount).toBe(data.amount)
        expect(decoded!.memo).toBe(data.memo)
        expect(decoded!.chainId).toBe(data.chainId)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 6: round-trip preserves optional fields (expiresAt, signature)', () => {
    const withOptionalsArb = fc.record({
      address: ethAddressArb,
      token: tokenArb,
      amount: amountArb,
      memo: memoArb,
      chainId: fc.constant(84532),
      expiresAt: fc.option(fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }), { nil: undefined }),
      signature: fc.option(
        fc.array(hexCharArb, { minLength: 64, maxLength: 64 }).map((c) => c.join('')),
        { nil: undefined },
      ),
    }) as fc.Arbitrary<PaymentLinkData>

    fc.assert(
      fc.property(withOptionalsArb, (data) => {
        const encoded = encodePaymentLink(data)
        const decoded = decodePaymentLink(encoded)

        expect(decoded).not.toBeNull()
        expect(decoded!.address).toBe(data.address)
        expect(decoded!.token).toBe(data.token)
        expect(decoded!.amount).toBe(data.amount)
        expect(decoded!.memo).toBe(data.memo)
        expect(decoded!.chainId).toBe(data.chainId)
        expect(decoded!.expiresAt).toBe(data.expiresAt)
        expect(decoded!.signature).toBe(data.signature)
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: token-chain-expansion, Property 13: Encode/Decode Round-Trip Preserves All Fields and Types
describe('encode/decode round-trip (multi-chain)', () => {
  const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
  const ethAddressArb = fc
    .array(hexCharArb, { minLength: 40, maxLength: 40 })
    .map((chars) => `0x${chars.join('')}`)

  const amountArb = fc.oneof(
    fc.constant(''),
    fc
      .float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true })
      .filter((n) => n > 0)
      .map((n) => n.toString()),
  )

  const memoArb = fc.string({ minLength: 0, maxLength: 200 }).filter((s) => {
    try {
      const json = JSON.stringify(s)
      JSON.parse(json)
      encodeURIComponent(s)
      return true
    } catch {
      return false
    }
  })

  const chainIdArb = fc.constantFrom(...getSupportedChains().map((c) => c.chainId))

  const multiChainPaymentLinkArb: fc.Arbitrary<PaymentLinkData> = chainIdArb.chain(
    (chainId) =>
      fc.record({
        address: ethAddressArb,
        token: fc.constantFrom(...getTokensForChain(chainId).map((t) => t.symbol)),
        amount: amountArb,
        memo: memoArb,
        chainId: fc.constant(chainId),
      }) as fc.Arbitrary<PaymentLinkData>,
  )

  it('Property 13: decoding an encoded PaymentLinkData returns deeply equal data with correct types', () => {
    fc.assert(
      fc.property(multiChainPaymentLinkArb, (data) => {
        const encoded = encodePaymentLink(data)
        const decoded = decodePaymentLink(encoded)

        expect(decoded).not.toBeNull()
        expect(decoded!.address).toBe(data.address)
        expect(decoded!.token).toBe(data.token)
        expect(decoded!.amount).toBe(data.amount)
        expect(decoded!.memo).toBe(data.memo)
        // chainId must be a number, not a string
        expect(typeof decoded!.chainId).toBe('number')
        expect(decoded!.chainId).toBe(data.chainId)
        // token must be a string symbol
        expect(typeof decoded!.token).toBe('string')
      }),
      { numRuns: 100 },
    )
  })
})
