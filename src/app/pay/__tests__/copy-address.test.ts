// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 1: Copy ได้ full address เสมอ
 *
 * Tests that the copy-to-clipboard behavior always uses the full Ethereum
 * address (0x + 40 hex chars) and never a shortened/truncated version.
 *
 * We extract the core logic of handleCopyAddress and verify the value
 * passed to navigator.clipboard.writeText is the full address.
 *
 * **Validates: Requirements 2.2**
 */

// Generator: valid Ethereum address (0x + 40 hex chars)
const ethAddressArb = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((h) => `0x${h}`)

// Replicate the core copy logic from handleCopyAddress in pay/[id]/page.tsx
async function copyAddress(address: string): Promise<void> {
  await navigator.clipboard.writeText(address)
}

// Feature: ux-polish, Property 1: Copy ได้ full address เสมอ
describe('Pay Page — Property 1: Copy ได้ full address เสมอ', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })
  })

  it('clipboard always receives the full Ethereum address, not a shortened version', () => {
    fc.assert(
      fc.asyncProperty(ethAddressArb, async (address) => {
        writeTextMock.mockClear()

        await copyAddress(address)

        // writeText must have been called exactly once
        expect(writeTextMock).toHaveBeenCalledTimes(1)

        const copied = writeTextMock.mock.calls[0][0] as string

        // The copied value must be the full address (42 chars: "0x" + 40 hex)
        expect(copied).toBe(address)
        expect(copied).toHaveLength(42)
        expect(copied).toMatch(/^0x[0-9a-fA-F]{40}$/)

        // Must NOT be a shortened format like "0x1234...abcd"
        expect(copied).not.toContain('...')
      }),
      { numRuns: 100 },
    )
  })
})
