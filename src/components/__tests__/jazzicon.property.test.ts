import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateColors } from '../Jazzicon'

/**
 * Feature: payo-rebrand, Property 2: Jazzicon determinism — address เดียวกันได้ผลเหมือนกัน
 *
 * For any valid Ethereum address, calling generateColors twice with the same
 * address must produce identical color arrays every time.
 *
 * Validates: Requirements 5.1, 5.2
 */

const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddress = fc.array(hexChar, { minLength: 40, maxLength: 40 }).map(chars => '0x' + chars.join(''))

describe('Feature: payo-rebrand, Property 2: Jazzicon determinism — address เดียวกันได้ผลเหมือนกัน', () => {
  it('generateColors returns the same colors for the same address across multiple calls', () => {
    fc.assert(
      fc.property(ethAddress, (addr) => {
        const first = generateColors(addr)
        const second = generateColors(addr)

        expect(first).toEqual(second)
        expect(first.length).toBe(5)
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Feature: payo-rebrand, Property 3: Jazzicon uniqueness — address ต่างกันได้ผลต่างกัน
 *
 * For any two distinct valid Ethereum addresses, calling generateColors must
 * produce different color arrays — ensuring visual distinction between wallets.
 *
 * Validates: Requirements 5.2
 */

const hexChar2 = fc.constantFrom(...'0123456789abcdef'.split(''))
const ethAddress2 = fc.array(hexChar2, { minLength: 40, maxLength: 40 }).map(chars => '0x' + chars.join(''))

describe('Feature: payo-rebrand, Property 3: Jazzicon uniqueness — address ต่างกันได้ผลต่างกัน', () => {
  it('generateColors returns different colors for different addresses', () => {
    fc.assert(
      fc.property(
        ethAddress2,
        ethAddress2,
        (addr1, addr2) => {
          // Only test when addresses are actually distinct
          fc.pre(addr1 !== addr2)

          const colors1 = generateColors(addr1)
          const colors2 = generateColors(addr2)

          expect(colors1.length).toBe(5)
          expect(colors2.length).toBe(5)

          // At least one color in the array should differ
          const allSame = colors1.every((c, i) => c === colors2[i])
          expect(allSame).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
