import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isMobileBrowserUA, isInAppBrowserUA } from '../mobileDetect'

/**
 * Feature: ux-improvements, Property 7: Mobile browser detection consistency
 *
 * For any user agent string, `isMobileBrowserUA` returns true iff the UA
 * matches a mobile device pattern (Android/iPhone/iPad/iPod) AND does NOT
 * match an in-app wallet browser pattern (MetaMask/Trust/Coinbase/Rainbow).
 *
 * Validates: Requirements 5.1, 5.4
 */

const MOBILE_TOKENS = ['Android', 'iPhone', 'iPad', 'iPod'] as const
const WALLET_TOKENS = ['MetaMask', 'Trust', 'Coinbase', 'Rainbow'] as const

/** Arbitrary that produces a mobile UA without wallet keywords → should be true */
const mobileUA = fc
  .tuple(
    fc.constantFrom(...MOBILE_TOKENS),
    fc.string({ minLength: 0, maxLength: 40 }),
  )
  .map(([token, suffix]) => `Mozilla/5.0 (${token}; Linux) ${suffix}`)
  .filter((ua) => !WALLET_TOKENS.some((w) => ua.toLowerCase().includes(w.toLowerCase())))

/** Arbitrary that produces a desktop UA (no mobile token, no wallet token) */
const desktopUA = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter(
    (ua) =>
      !MOBILE_TOKENS.some((m) => ua.toLowerCase().includes(m.toLowerCase())) &&
      !WALLET_TOKENS.some((w) => ua.toLowerCase().includes(w.toLowerCase())),
  )

/** Arbitrary that produces a mobile UA WITH a wallet keyword → should be false */
const inAppUA = fc
  .tuple(
    fc.constantFrom(...MOBILE_TOKENS),
    fc.constantFrom(...WALLET_TOKENS),
    fc.string({ minLength: 0, maxLength: 30 }),
  )
  .map(([mobile, wallet, suffix]) => `Mozilla/5.0 (${mobile}) ${wallet}Browser/1.0 ${suffix}`)

describe('Feature: ux-improvements, Property 7: Mobile browser detection consistency', () => {
  it('mobile UA without wallet keywords → isMobileBrowserUA returns true', () => {
    fc.assert(
      fc.property(mobileUA, (ua) => {
        expect(isMobileBrowserUA(ua)).toBe(true)
        expect(isInAppBrowserUA(ua)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('desktop UA → isMobileBrowserUA returns false', () => {
    fc.assert(
      fc.property(desktopUA, (ua) => {
        expect(isMobileBrowserUA(ua)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('mobile UA with wallet keywords → isMobileBrowserUA returns false, isInAppBrowserUA returns true', () => {
    fc.assert(
      fc.property(inAppUA, (ua) => {
        expect(isMobileBrowserUA(ua)).toBe(false)
        expect(isInAppBrowserUA(ua)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
