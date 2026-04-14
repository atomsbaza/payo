// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import { encodeTransferLink } from '@/lib/encode'
import { translations } from '@/lib/i18n'

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/pay/test',
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: (props: { label?: string; showBalance?: boolean; accountStatus?: string; chainStatus?: string }) => (
    <button data-testid="connect-button">{props.label ?? 'Connect'}</button>
  ),
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
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
  getContractAddress: () => '0x0000000000000000000000000000000000000001' as `0x${string}`,
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
  useEnsName: () => ({ data: undefined }),
}))

// Mock global fetch for HMAC verification
beforeEach(() => {
  mockFeeRate = 100n
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ verified: true, tampered: false }),
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
    const id = encodeTransferLink({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: 'ETH',
      amount: '1.0',
      memo: 'test',
      chainId: 84532,
    })

    await renderPayPage(id)

    // Fee breakdown is hidden by default behind a toggle
    const toggleBtn = await screen.findByRole('button', { name: /show donation details/i })
    expect(toggleBtn).toBeTruthy()
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')

    // Fee details should not be visible before toggle
    expect(screen.queryByText('Donation rate')).toBeNull()

    // Click toggle to expand
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')
    expect(await screen.findByText('Donation rate')).toBeTruthy()
    expect(screen.getByText('Total sent')).toBeTruthy()
    expect(screen.getByText('Donation')).toBeTruthy()
    expect(screen.getByText('Recipient receives')).toBeTruthy()

    // Fee rate should show "1%" for 100 basis points
    expect(screen.getByText('1%')).toBeTruthy()
  })

  it('displays "No fee" when fee is zero (Req 4.4)', async () => {
    mockFeeRate = 0n

    const id = encodeTransferLink({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: 'ETH',
      amount: '1.0',
      memo: 'test zero fee',
      chainId: 84532,
    })

    await renderPayPage(id)

    // Click toggle to expand fee details
    const toggleBtn = await screen.findByRole('button', { name: /show donation details/i })
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    expect(await screen.findByText('No donation')).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('recalculates fee breakdown when custom amount is entered (Req 4.2)', async () => {
    const id = encodeTransferLink({
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

    // Initially no fee breakdown toggle (no amount entered)
    expect(screen.queryByRole('button', { name: /show donation details/i })).toBeNull()

    // Enter a custom amount
    await act(async () => {
      fireEvent.change(input, { target: { value: '2.0' } })
    })

    // Toggle should now appear
    const toggleBtn = await screen.findByRole('button', { name: /show donation details/i })
    expect(toggleBtn).toBeTruthy()

    // Click toggle to expand
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    // Fee breakdown should now appear
    await waitFor(() => {
      expect(screen.getByText('Donation rate')).toBeTruthy()
    })
    expect(screen.getByText('Total sent')).toBeTruthy()
    expect(screen.getByText('Recipient receives')).toBeTruthy()
  })
})
