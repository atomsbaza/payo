// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { render } from '@testing-library/react'

// --- Mocks ---

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: {
      paySuccess: 'Payment Successful! 🎉',
      paySuccessDesc: (amount: string, token: string) => `${amount} ${token} has been sent to the recipient`,
      viewOnBasescan: 'View Transaction on Basescan ↗',
      successCreateNew: 'Create New Payment Link',
      successGoHome: 'Go Home',
      successShare: 'Share Receipt',
      successTxHash: 'TX Hash',
      successRecipient: 'Recipient',
      successShareText: (amount: string, token: string, hash: string) => `I just sent ${amount} ${token} successfully! TX: ${hash}`,
    },
    toggleLang: () => {},
  }),
}))

import { SuccessView } from '../SuccessView'

// --- Generators ---

const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''))

const addressArb = fc.tuple(
  fc.array(hexChar, { minLength: 40, maxLength: 40 })
).map(([chars]) => `0x${chars.join('')}` as `0x${string}`)

const txHashArb = fc.tuple(
  fc.array(hexChar, { minLength: 64, maxLength: 64 })
).map(([chars]) => `0x${chars.join('')}` as `0x${string}`)

const amountArb = fc.float({ min: Math.fround(0.001), max: Math.fround(99999), noNaN: true })
  .map(n => n.toFixed(4))

const tokenArb = fc.constantFrom('ETH', 'USDC', 'DAI', 'WBTC')

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

describe('SuccessView — Property 4: Success view contains all required payment info', () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * Property 4: For any valid payment result (amount, token symbol,
   * recipient address, transaction hash), the SuccessView component
   * should render output containing all four pieces of information:
   * the amount, the token, the recipient in short address format,
   * and the transaction hash in short format.
   */
  it('rendered output contains amount, token, short recipient, and short txHash', () => {
    fc.assert(
      fc.property(
        amountArb,
        tokenArb,
        addressArb,
        txHashArb,
        (amount, token, recipientAddress, txHash) => {
          const { container } = render(
            <SuccessView
              amount={amount}
              token={token}
              recipientAddress={recipientAddress}
              txHash={txHash}
            />
          )

          const text = container.textContent ?? ''

          // Amount appears in the success description
          expect(text).toContain(amount)

          // Token appears in the success description
          expect(text).toContain(token)

          // Recipient in short address format
          const shortRecipient = shortAddress(recipientAddress)
          expect(text).toContain(shortRecipient)

          // TX hash in short format
          const shortTx = shortAddress(txHash)
          expect(text).toContain(shortTx)
        }
      ),
      { numRuns: 100 }
    )
  })
})
