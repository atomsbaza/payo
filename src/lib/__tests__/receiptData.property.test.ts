import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { buildReceiptData, serializeReceiptData, deserializeReceiptData } from '@/lib/receiptData'

// Feature: payment-receipt, Property 1: ReceiptData construction completeness

/**
 * Property 1: ReceiptData construction completeness
 *
 * For any valid combination of payment link data (address, token, amount,
 * chainId, memo), payer address, tx hash, confirmed timestamp, and fee
 * breakdown, constructing a ReceiptData object SHALL produce an object where
 * every required field is a non-empty string or valid number, and memo
 * defaults to empty string when not provided.
 *
 * **Validates: Requirements 1.1, 1.3, 1.4**
 */

// --- Arbitraries ---

/** Hex string of exact length */
const hexStringArb = (len: number) =>
  fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: len, maxLength: len })
    .map(chars => chars.join(''))

/** Ethereum address: 0x + 40 hex chars */
const ethAddressArb = hexStringArb(40).map(hex => `0x${hex}`)

/** TX hash: 0x + 64 hex chars */
const txHashArb = hexStringArb(64).map(hex => `0x${hex}`)

/** Valid decimal amount string like "0.01" or "123.456789" */
const amountArb = fc
  .tuple(
    fc.integer({ min: 0, max: 999999 }),
    fc.integer({ min: 0, max: 999999999 }),
  )
  .map(([whole, frac]) => `${whole}.${frac}`)

/** Block explorer URL starting with https:// */
const blockExplorerUrlArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 3, maxLength: 20 })
  .map(chars => `https://${chars.join('')}.io`)

/** Token decimals: one of 6, 8, 18 */
const tokenDecimalsArb = fc.constantFrom(6, 8, 18)

/** Valid BigInt string (non-negative) */
const bigIntStringArb = fc
  .bigInt({ min: 0n, max: 10n ** 24n })
  .map(n => n.toString())

/** Generator for BuildReceiptDataInput (without memo — to test default) */
const buildInputWithoutMemoArb = fc.record({
  payerAddress: ethAddressArb,
  recipientAddress: ethAddressArb,
  tokenSymbol: fc.string({ minLength: 1, maxLength: 10 }),
  tokenName: fc.string({ minLength: 1, maxLength: 30 }),
  amount: amountArb,
  chainName: fc.string({ minLength: 1, maxLength: 30 }),
  chainId: fc.integer({ min: 1, max: 999999 }),
  txHash: txHashArb,
  blockExplorerUrl: blockExplorerUrlArb,
  confirmedAt: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  feeTotal: bigIntStringArb,
  feeAmount: bigIntStringArb,
  feeNet: bigIntStringArb,
  feeRateBps: bigIntStringArb,
  tokenDecimals: tokenDecimalsArb,
})

/** Generator for BuildReceiptDataInput (with memo) */
const buildInputWithMemoArb = buildInputWithoutMemoArb.chain(input =>
  fc.string({ minLength: 1, maxLength: 100 }).map(memo => ({ ...input, memo })),
)

// --- Tests ---

describe('Feature: payment-receipt, Property 1: ReceiptData construction completeness', () => {
  /**
   * Every required string field is non-empty and every required number field
   * is valid after calling buildReceiptData with a complete input.
   *
   * **Validates: Requirements 1.1, 1.3, 1.4**
   */
  it('all required fields are non-empty strings or valid numbers for any valid input', () => {
    fc.assert(
      fc.property(buildInputWithMemoArb, (input) => {
        const result = buildReceiptData(input)

        // Required string fields must be non-empty
        expect(result.payerAddress).toBeTruthy()
        expect(result.recipientAddress).toBeTruthy()
        expect(result.tokenSymbol).toBeTruthy()
        expect(result.tokenName).toBeTruthy()
        expect(result.amount).toBeTruthy()
        expect(result.chainName).toBeTruthy()
        expect(result.txHash).toBeTruthy()
        expect(result.blockExplorerUrl).toBeTruthy()

        // chainId is a positive number
        expect(result.chainId).toBeGreaterThan(0)

        // confirmedAt is a positive number
        expect(result.confirmedAt).toBeGreaterThan(0)

        // tokenDecimals is one of 6, 8, 18
        expect([6, 8, 18]).toContain(result.tokenDecimals)

        // Fee fields are valid strings (can be parsed as BigInt)
        expect(() => BigInt(result.feeTotal)).not.toThrow()
        expect(() => BigInt(result.feeAmount)).not.toThrow()
        expect(() => BigInt(result.feeNet)).not.toThrow()
        expect(() => BigInt(result.feeRateBps)).not.toThrow()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * When memo is not provided, it defaults to empty string.
   *
   * **Validates: Requirements 1.3**
   */
  it('memo defaults to empty string when not provided', () => {
    fc.assert(
      fc.property(buildInputWithoutMemoArb, (input) => {
        // Explicitly remove memo to test the default
        const { ...inputWithoutMemo } = input
        delete (inputWithoutMemo as Record<string, unknown>).memo

        const result = buildReceiptData(inputWithoutMemo)

        expect(result.memo).toBe('')
      }),
      { numRuns: 100 },
    )
  })
})


// Feature: payment-receipt, Property 8: ReceiptData serialization round-trip

/**
 * Property 8: ReceiptData serialization round-trip
 *
 * For any valid ReceiptData object, deserializeReceiptData(serializeReceiptData(data))
 * SHALL produce an object deeply equal to the original, including correct preservation
 * of BigInt fee values stored as strings.
 *
 * **Validates: Requirements 7.1, 7.2**
 */
describe('Feature: payment-receipt, Property 8: ReceiptData serialization round-trip', () => {
  it('deserialize(serialize(data)) produces an object deeply equal to the original', () => {
    fc.assert(
      fc.property(buildInputWithMemoArb, (input) => {
        const original = buildReceiptData(input)
        const roundTripped = deserializeReceiptData(serializeReceiptData(original))

        expect(roundTripped).toEqual(original)
      }),
      { numRuns: 100 },
    )
  })
})


// Feature: payment-receipt, Property 9: Fee invariant

/**
 * Property 9: Fee invariant
 *
 * For any valid ReceiptData object where BigInt(feeTotal) > 0n, the invariant
 * BigInt(feeAmount) + BigInt(feeNet) === BigInt(feeTotal) SHALL hold.
 *
 * **Validates: Requirements 7.3**
 */
describe('Feature: payment-receipt, Property 9: Fee invariant', () => {
  /**
   * Custom arbitrary that generates fee values satisfying the invariant
   * feeTotal = feeAmount + feeNet by construction.
   */
  const feeConstrainedInputArb = fc
    .tuple(
      fc.bigInt({ min: 1n, max: 10n ** 24n }),  // feeAmount (positive)
      fc.bigInt({ min: 1n, max: 10n ** 24n }),  // feeNet (positive)
    )
    .chain(([feeAmount, feeNet]) => {
      const feeTotal = feeAmount + feeNet
      return fc.record({
        payerAddress: ethAddressArb,
        recipientAddress: ethAddressArb,
        tokenSymbol: fc.string({ minLength: 1, maxLength: 10 }),
        tokenName: fc.string({ minLength: 1, maxLength: 30 }),
        amount: amountArb,
        chainName: fc.string({ minLength: 1, maxLength: 30 }),
        chainId: fc.integer({ min: 1, max: 999999 }),
        txHash: txHashArb,
        blockExplorerUrl: blockExplorerUrlArb,
        confirmedAt: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        feeTotal: fc.constant(feeTotal.toString()),
        feeAmount: fc.constant(feeAmount.toString()),
        feeNet: fc.constant(feeNet.toString()),
        feeRateBps: bigIntStringArb,
        tokenDecimals: tokenDecimalsArb,
        memo: fc.string({ minLength: 0, maxLength: 100 }),
      })
    })

  it('BigInt(feeAmount) + BigInt(feeNet) === BigInt(feeTotal) for any valid ReceiptData with feeTotal > 0', () => {
    fc.assert(
      fc.property(feeConstrainedInputArb, (input) => {
        const result = buildReceiptData(input)

        const total = BigInt(result.feeTotal)
        const amount = BigInt(result.feeAmount)
        const net = BigInt(result.feeNet)

        expect(total).toBeGreaterThan(0n)
        expect(amount + net).toBe(total)
      }),
      { numRuns: 100 },
    )
  })
})
