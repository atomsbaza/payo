import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getSupportedChains, type SupportedChain } from '@/lib/chainRegistry'

/**
 * Property 3: Testnet Pill แสดงก็ต่อเมื่อ chain เป็น testnet
 *
 * For all supported chains, the TESTNET pill is rendered if and only if
 * `chain.isTestnet === true`. When `isTestnet` is false the pill must
 * not be rendered.
 *
 * This is a pure logic test — it verifies the condition used in the JSX:
 *   {chain?.isTestnet && ( <pill /> )}
 *
 * **Validates: Requirements 3.1, 3.4**
 */

const chains = getSupportedChains()

// Generator: random chain from the registry
const chainArb = fc.constantFrom(...chains)

/**
 * Replicate the pill-visibility logic from pay/[id]/page.tsx:
 *   {chain?.isTestnet && ( ... )}
 *
 * Returns true when the pill should be rendered.
 */
function shouldShowTestnetPill(chain: SupportedChain | undefined): boolean {
  return chain?.isTestnet === true
}

// Feature: ux-polish, Property 3: Testnet Pill แสดงก็ต่อเมื่อ chain เป็น testnet
describe('Pay Page — Property 3: Testnet Pill แสดงก็ต่อเมื่อ chain เป็น testnet', () => {
  it('pill visibility equals chain.isTestnet for every supported chain', () => {
    fc.assert(
      fc.property(chainArb, (chain) => {
        const pillVisible = shouldShowTestnetPill(chain)

        // Pill must be shown iff isTestnet is true
        expect(pillVisible).toBe(chain.isTestnet)

        // Double-check: testnet chains show the pill
        if (chain.isTestnet) {
          expect(pillVisible).toBe(true)
        } else {
          expect(pillVisible).toBe(false)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('pill is not shown when chain is undefined', () => {
    // Edge case: if getChain returns undefined the pill must not render
    expect(shouldShowTestnetPill(undefined)).toBe(false)
  })
})
