import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { getValidatedLinks } from '../validate-storage'

// Feature: security-hardening, Property 7: LocalStorage validator กรอง item ที่ไม่ถูกต้องออกและเก็บเฉพาะ item ที่ valid
// Validates: Requirements 5.1, 5.2, 5.4

// Mock localStorage for node environment
const store = new Map<string, string>()
const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
  removeItem: vi.fn((key: string) => { store.delete(key) }),
  clear: vi.fn(() => store.clear()),
  get length() { return store.size },
  key: vi.fn((index: number) => [...store.keys()][index] ?? null),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Hex char arbitrary
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddressArb = fc.array(hexCharArb, { minLength: 40, maxLength: 40 }).map(chars => `0x${chars.join('')}`)

// Arbitrary: valid SavedLink object
const validSavedLinkArb = fc.record({
  url: fc.webUrl(),
  address: ethAddressArb,
  token: fc.constantFrom('ETH', 'USDC'),
  amount: fc.oneof(fc.constant(''), fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true }).map(String)),
  memo: fc.string({ maxLength: 200 }),
  createdAt: fc.integer({ min: 0, max: Date.now() * 2 }),
})

// Arbitrary: invalid item (missing or wrong-typed fields)
const invalidItemArb = fc.oneof(
  fc.constant(null),
  fc.constant(42),
  fc.constant('not-an-object'),
  // object missing required fields
  fc.record({ url: fc.string() }),
  // object with wrong types
  fc.record({
    url: fc.integer(),
    address: fc.integer(),
    token: fc.integer(),
    amount: fc.integer(),
    memo: fc.integer(),
    createdAt: fc.string(),
  }),
)

describe('getValidatedLinks - Property 7', () => {
  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('returns only valid items from a mixed array of valid and invalid items', () => {
    fc.assert(
      fc.property(
        fc.array(validSavedLinkArb, { minLength: 0, maxLength: 10 }),
        fc.array(invalidItemArb, { minLength: 1, maxLength: 10 }),
        (validItems, invalidItems) => {
          // Interleave valid and invalid items
          const mixed = [...validItems, ...invalidItems]
          // Shuffle deterministically by alternating
          const shuffled = mixed.sort(() => 0.5 - Math.random())

          store.set('myLinks', JSON.stringify(shuffled))

          const result = getValidatedLinks()

          // All returned items must be valid SavedLink objects
          expect(result).toHaveLength(validItems.length)
          for (const item of result) {
            expect(item).toHaveProperty('url')
            expect(item).toHaveProperty('address')
            expect(item).toHaveProperty('token')
            expect(item).toHaveProperty('amount')
            expect(item).toHaveProperty('memo')
            expect(item).toHaveProperty('createdAt')
            expect(typeof item.url).toBe('string')
            expect(typeof item.address).toBe('string')
            expect(typeof item.token).toBe('string')
            expect(typeof item.amount).toBe('string')
            expect(typeof item.memo).toBe('string')
            expect(typeof item.createdAt).toBe('number')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('writes back only valid items to localStorage when invalid items are filtered (Req 5.4)', () => {
    fc.assert(
      fc.property(
        fc.array(validSavedLinkArb, { minLength: 1, maxLength: 5 }),
        fc.array(invalidItemArb, { minLength: 1, maxLength: 5 }),
        (validItems, invalidItems) => {
          const mixed = [...validItems, ...invalidItems]
          store.set('myLinks', JSON.stringify(mixed))

          const result = getValidatedLinks()

          // localStorage should be updated with only valid items
          const stored = JSON.parse(store.get('myLinks')!)
          expect(stored).toHaveLength(result.length)
          expect(stored).toHaveLength(validItems.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Task 7.3: Edge case tests — Validates: Requirements 5.3
  it('returns empty array when localStorage contains non-JSON string', () => {
    store.set('myLinks', 'this is not json!!!')
    const result = getValidatedLinks()
    expect(result).toEqual([])
    expect(store.get('myLinks')).toBe('[]')
  })

  it('returns empty array when localStorage has no myLinks key', () => {
    store.delete('myLinks')
    const result = getValidatedLinks()
    expect(result).toEqual([])
  })

  it('returns all items unchanged when every item is valid', () => {
    fc.assert(
      fc.property(
        fc.array(validSavedLinkArb, { minLength: 1, maxLength: 10 }),
        (validItems) => {
          store.set('myLinks', JSON.stringify(validItems))

          const result = getValidatedLinks()

          expect(result).toHaveLength(validItems.length)
          // Each returned item should deep-equal the input
          for (let i = 0; i < validItems.length; i++) {
            expect(result[i]).toEqual(validItems[i])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
