// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import { encodePaymentLink } from '@/lib/encode'
import { translations } from '@/lib/i18n'

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/pay/test',
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: (props: { label?: string; showBalance?: boolean; accountStatus?: string; chainStatus?: string }) => (
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

// Mock contract config so contractReady is true in tests
vi.mock('@/lib/contract', () => ({
  CRYPTO_PAY_LINK_ADDRESS: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  COMPANY_WALLET: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  DEFAULT_FEE_RATE: 100n,
  CryptoPayLinkFeeABI: [
    { type: 'function', name: 'feeRate', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { type: 'function', name: 'payNative', stateMutability: 'payable', inputs: [{ name: 'payee', type: 'address' }, { name: 'memo', type: 'string' }], outputs: [] },
  ] as const,
}))

// Track the feeRate returned by the mock
let mockFeeRate: bigint = 100n

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0xabc0000000000000000000000000000000000001', isConnected: true }),
  useBalance: () => ({ data: { value: 10000000000000000000n } }),
  useReadContract: (args: { functionName?: string }) => {
    if (args?.functionName === 'balanceOf') {
      return { data: 10000000000n }
    }
    // feeRate call
    return { data: mockFeeRate, isError: false }
  },
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useChainId: () => 84532,
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}))

// Mock global fetch for HMAC verification
beforeEach(() => {
  mockFeeRate = 100n
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ verified: true }),
  })
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
  return result!
}

// --- Tests ---

describe('Payment Page Fee Breakdown', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.4, 6.1**
   * Property 9: Fee transaction rendering completeness
   */

  it('displays fee breakdown for a fixed amount (Req 4.1)', async () => {
    const id = encodePaymentLink({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: 'ETH',
      amount: '1.0',
      memo: 'test',
      chainId: 84532,
    })

    await renderPayPage(id)

    // Wait for HMAC verification to resolve and component to render fee breakdown
    expect(await screen.findByText('Fee rate')).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('Fee')).toBeTruthy()
    expect(screen.getByText('Recipient gets')).toBeTruthy()

    // Fee rate should show "1%" for 100 basis points
    expect(screen.getByText('1%')).toBeTruthy()
  })

  it('displays "No fee" when fee is zero (Req 4.4)', async () => {
    mockFeeRate = 0n

    const id = encodePaymentLink({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: 'ETH',
      amount: '1.0',
      memo: 'test zero fee',
      chainId: 84532,
    })

    await renderPayPage(id)

    expect(await screen.findByText('No fee')).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('recalculates fee breakdown when custom amount is entered (Req 4.2)', async () => {
    const id = encodePaymentLink({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: 'ETH',
      amount: '',
      memo: 'custom amount',
      chainId: 84532,
    })

    await renderPayPage(id)

    // Wait for HMAC to resolve — the custom amount input should appear
    const input = await screen.findByPlaceholderText('0.00')
    expect(input).toBeTruthy()

    // Initially no fee breakdown (no amount entered)
    expect(screen.queryByText('Fee rate')).toBeNull()

    // Enter a custom amount
    await act(async () => {
      fireEvent.change(input, { target: { value: '2.0' } })
    })

    // Fee breakdown should now appear
    await waitFor(() => {
      expect(screen.getByText('Fee rate')).toBeTruthy()
    })
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('Recipient gets')).toBeTruthy()
  })
})
