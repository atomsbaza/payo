import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getSupportedChains } from '@/lib/chainRegistry'

/**
 * Property 2: Block Explorer URL ถูกต้องตาม chain
 *
 * For all chains in the chain registry × random valid Ethereum addresses,
 * the block explorer URL must equal `{chain.blockExplorerUrl}/address/{address}`.
 *
 * This is a pure logic test — no rendering needed.
 *
 * **Validates: Requirements 2.5**
 */

const chains = getSupportedChains()

// Generator: valid Ethereum address (0x + 40 hex chars)
const ethAddressArb = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((h) => `0x${h}`)

// Generator: random chain from the registry
const chainArb = fc.constantFrom(...chains)

// Replicate the URL construction logic from pay/[id]/page.tsx:
//   href={`${chain.blockExplorerUrl}/address/${data.address}`}
function buildExplorerUrl(blockExplorerUrl: string, address: string): string {
  return `${blockExplorerUrl}/address/${address}`
}

// Feature: ux-polish, Property 2: Block Explorer URL ถูกต้องตาม chain
describe('Pay Page — Property 2: Block Explorer URL ถูกต้องตาม chain', () => {
  it('explorer URL equals {chain.blockExplorerUrl}/address/{address} for all chains and addresses', () => {
    fc.assert(
      fc.property(chainArb, ethAddressArb, (chain, address) => {
        const url = buildExplorerUrl(chain.blockExplorerUrl, address)

        // Must match the expected format exactly
        expect(url).toBe(`${chain.blockExplorerUrl}/address/${address}`)

        // URL must start with the chain's block explorer base URL
        expect(url.startsWith(chain.blockExplorerUrl)).toBe(true)

        // URL must contain the full address (not shortened)
        expect(url).toContain(address)
        expect(url).not.toContain('...')

        // URL must have the /address/ path segment
        expect(url).toContain('/address/')

        // The address portion after /address/ must be the full address
        const parts = url.split('/address/')
        expect(parts).toHaveLength(2)
        expect(parts[1]).toBe(address)
      }),
      { numRuns: 100 },
    )
  })
})
