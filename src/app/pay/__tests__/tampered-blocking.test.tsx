// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { render, screen, cleanup, act } from '@testing-library/react'
import { Suspense } from 'react'
import { encodePaymentLink } from '@/lib/encode'
import { translations } from '@/lib/i18n'

/**
 * Feature: tampered-link-blocking
 * Property 2: Tampered link blocks all payment UI
 *
 * **Validates: Requirements 1.1, 1.3, 2.1, 2.2, 5.2**
 */

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/pay/test',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: 'test' }),
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: (props: { label?: string }) => (
    <button data-testid="connect-button">{props.label ?? 'Connect'}</button>
  ),
}))

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: translations.en,
    toggleLang: () => {},
  }),
}))

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

vi.mock('@/lib/contract', () => ({
  CRYPTO_PAY_LINK_ADDRESS: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  COMPANY_WALLET: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  DEFAULT_FEE_RATE: 100n,
  CryptoPayLinkFeeABI: [
    { type: 'function', name: 'feeRate', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { type: 'function', name: 'payNative', stateMutability: 'payable', inputs: [{ name: 'payee', type: 'address' }, { name: 'memo', type: 'string' }], outputs: [] },
  ] as const,
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0xabc0000000000000000000000000000000000001', isConnected: true }),
  useBalance: () => ({ data: { value: 10000000000000000000n } }),
  useReadContract: (args: { functionName?: string }) => {
    if (args?.functionName === 'balanceOf') {
      return { data: 10000000000n }
    }
    return { data: 100n, isError: false }
  },
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useChainId: () => 84532,
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}))

// Valid encoded payment link for testing
const validPaymentId = encodePaymentLink({
  address: '0x1234567890abcdef1234567890abcdef12345678',
  token: 'ETH',
  amount: '1.0',
  memo: 'test',
  chainId: 84532,
})

// Track the tampered value for the current test iteration
let mockTampered = false

beforeEach(() => {
  cleanup()
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          verified: !mockTampered,
          tampered: mockTampered,
          data: {
            address: '0x1234567890abcdef1234567890abcdef12345678',
            token: 'ETH',
            amount: '1.0',
            memo: 'test',
            chainId: 84532,
          },
        }),
    })
  )
})

import PayPage from '../[id]/page'

// --- Helpers ---

async function renderPayPage(id: string) {
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <Suspense fallback={<div>Loading...</div>}>
        <PayPage params={Promise.resolve({ id })} />
      </Suspense>
    )
  })
  // Wait for the fetch/useEffect to resolve
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
  return result!
}

// --- Generators ---

const tamperedArb = fc.boolean()

// --- Tests ---

describe('Pay Page — Property 2: Tampered link blocks all payment UI', () => {
  /**
   * **Validates: Requirements 1.1, 1.3, 2.1, 2.2, 5.2**
   *
   * Property 2: For any HMAC verification result where tampered === true,
   * the Pay Page SHALL render BlockedScreen and SHALL NOT render the pay
   * button, custom amount input, balance display, or fee breakdown.
   * Conversely, when tampered === false, the Pay Page SHALL render the
   * payment card and SHALL NOT render BlockedScreen.
   */
  it('when tampered=true, shows BlockedScreen and hides payment UI; when tampered=false, shows payment card and hides BlockedScreen', async () => {
    // Property-based test with React rendering needs extended timeout
    await fc.assert(
      fc.asyncProperty(tamperedArb, async (tampered) => {
        mockTampered = tampered
        cleanup()

        await renderPayPage(validPaymentId)

        const t = translations.en

        if (tampered) {
          // BlockedScreen text should be present
          expect(screen.getByText(t.tamperedTitle)).toBeTruthy()

          // Pay button should be absent
          expect(screen.queryByText(/Send .+ ETH →/)).toBeNull()

          // Custom amount input should be absent
          expect(screen.queryByPlaceholderText('0.00')).toBeNull()

          // Balance display should be absent
          expect(screen.queryByText(t.labelBalance)).toBeNull()

          // Fee breakdown should be absent
          expect(screen.queryByText('Fee rate')).toBeNull()
        } else {
          // BlockedScreen text should be absent
          expect(screen.queryByText(t.tamperedTitle)).toBeNull()

          // Payment card should be present — check for recipient label
          expect(screen.getByText(t.labelRecipient)).toBeTruthy()
        }
      }),
      { numRuns: 100 }
    )
  }, 60_000)
})
