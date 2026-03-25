// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { Suspense } from 'react'
import { encodePaymentLink } from '@/lib/encode'
import { translations } from '@/lib/i18n'

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/pay/test',
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: (props: { label?: string }) => (
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

vi.mock('@/lib/contract', () => ({
  getContractAddress: () => '0x0000000000000000000000000000000000000001' as `0x${string}`,
  CRYPTO_PAY_LINK_ADDRESS: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  COMPANY_WALLET: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  DEFAULT_FEE_RATE: 100n,
  CryptoPayLinkFeeABI: [
    { type: 'function', name: 'feeRate', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  ] as const,
}))

// Control isProduction() return value per test
let mockIsProduction = false

vi.mock('@/lib/chainRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/chainRegistry')>()
  return {
    ...actual,
    isProduction: () => mockIsProduction,
  }
})

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0xabc0000000000000000000000000000000000001', isConnected: false }),
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
  useEnsName: () => ({ data: undefined }),
}))

beforeEach(() => {
  mockIsProduction = false
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ verified: true, tampered: false }),
  })
})

import PayPage from '../[id]/page'

// --- Helpers ---

function makeTestnetLink() {
  return encodePaymentLink({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    token: 'ETH',
    amount: '0.01',
    memo: 'testnet test',
    chainId: 84532, // Base Sepolia (testnet)
  })
}

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

/**
 * **Validates: Requirements 5.2**
 */
describe('Pay Page — Testnet Warning Banner', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders testnet-prod-warning banner when isProduction() is true and chain is testnet', async () => {
    mockIsProduction = true
    const id = makeTestnetLink()

    await renderPayPage(id)

    // Wait for HMAC verification to resolve and content to render
    const warning = await screen.findByTestId('testnet-prod-warning')
    expect(warning).toBeTruthy()
    expect(warning.textContent).toContain('Testnet Link')
    expect(warning.textContent).toContain('Base Sepolia')
  })

  it('does NOT render testnet-prod-warning banner in dev mode (isProduction false)', async () => {
    mockIsProduction = false
    const id = makeTestnetLink()

    await renderPayPage(id)

    // Wait for content to render (HMAC resolves)
    await screen.findByText(/0\.01/)

    // Warning banner should not be present
    expect(screen.queryByTestId('testnet-prod-warning')).toBeNull()
  })
})
