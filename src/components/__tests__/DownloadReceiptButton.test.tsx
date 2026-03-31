// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { translations } from '@/lib/i18n'
import type { ReceiptData } from '@/lib/receiptData'

// --- Fixture ---

const sampleReceiptData: ReceiptData = {
  payerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  recipientAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  tokenSymbol: 'USDC',
  tokenName: 'USD Coin',
  amount: '100.00',
  chainName: 'Base',
  chainId: 8453,
  txHash: '0x' + 'a'.repeat(64),
  blockExplorerUrl: 'https://basescan.org',
  memo: 'Test payment',
  confirmedAt: 1700000000000,
  feeTotal: '100000000',
  feeAmount: '1000000',
  feeNet: '99000000',
  feeRateBps: '100',
  tokenDecimals: 6,
}

// --- Mock for generateReceiptPdf (dynamic import) ---

let mockGenerateReceiptPdf: ReturnType<typeof vi.fn>

vi.mock('@/lib/generateReceiptPdf', () => ({
  get generateReceiptPdf() {
    return mockGenerateReceiptPdf
  },
}))

import { DownloadReceiptButton } from '../DownloadReceiptButton'

beforeEach(() => {
  cleanup()
  mockGenerateReceiptPdf = vi.fn()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  globalThis.URL.revokeObjectURL = vi.fn()
})

// --- Tests ---

describe('DownloadReceiptButton', () => {
  /**
   * **Validates: Requirements 2.1**
   */
  it('renders correct label in English ("Download Receipt")', () => {
    const { container } = render(
      <DownloadReceiptButton receiptData={sampleReceiptData} locale="en" />
    )
    const btn = container.querySelector('button')!
    expect(btn.textContent).toBe(translations.en.receiptDownload)
  })

  /**
   * **Validates: Requirements 2.1**
   */
  it('renders correct label in Thai ("ดาวน์โหลด Receipt")', () => {
    const { container } = render(
      <DownloadReceiptButton receiptData={sampleReceiptData} locale="th" />
    )
    const btn = container.querySelector('button')!
    expect(btn.textContent).toBe(translations.th.receiptDownload)
  })

  /**
   * **Validates: Requirements 2.4**
   */
  it('shows loading state while generating PDF (English)', async () => {
    let resolveGenerate!: (value: unknown) => void
    mockGenerateReceiptPdf.mockReturnValue(
      new Promise((resolve) => { resolveGenerate = resolve })
    )

    const { container } = render(
      <DownloadReceiptButton receiptData={sampleReceiptData} locale="en" />
    )
    const btn = container.querySelector('button')!

    fireEvent.click(btn)

    await waitFor(() => {
      expect(btn.textContent).toBe(translations.en.receiptGenerating)
    })
    expect(btn.disabled).toBe(true)

    // Resolve to clean up
    resolveGenerate({ output: vi.fn(() => new ArrayBuffer(8)) })
  })

  /**
   * **Validates: Requirements 2.4**
   */
  it('shows loading state while generating PDF (Thai)', async () => {
    let resolveGenerate!: (value: unknown) => void
    mockGenerateReceiptPdf.mockReturnValue(
      new Promise((resolve) => { resolveGenerate = resolve })
    )

    const { container } = render(
      <DownloadReceiptButton receiptData={sampleReceiptData} locale="th" />
    )
    const btn = container.querySelector('button')!

    fireEvent.click(btn)

    await waitFor(() => {
      expect(btn.textContent).toBe(translations.th.receiptGenerating)
    })
    expect(btn.disabled).toBe(true)

    resolveGenerate({ output: vi.fn(() => new ArrayBuffer(8)) })
  })

  /**
   * **Validates: Requirements 2.5**
   */
  it('shows error state when PDF generation fails (English)', async () => {
    mockGenerateReceiptPdf.mockRejectedValue(new Error('PDF generation failed'))

    const { container } = render(
      <DownloadReceiptButton receiptData={sampleReceiptData} locale="en" />
    )
    const btn = container.querySelector('button')!

    fireEvent.click(btn)

    await waitFor(() => {
      expect(btn.textContent).toBe(translations.en.receiptError)
    })
    expect(btn.disabled).toBe(false)
  })

  /**
   * **Validates: Requirements 2.5**
   */
  it('shows error state when PDF generation fails (Thai)', async () => {
    mockGenerateReceiptPdf.mockRejectedValue(new Error('PDF generation failed'))

    const { container } = render(
      <DownloadReceiptButton receiptData={sampleReceiptData} locale="th" />
    )
    const btn = container.querySelector('button')!

    fireEvent.click(btn)

    await waitFor(() => {
      expect(btn.textContent).toBe(translations.th.receiptError)
    })
    expect(btn.disabled).toBe(false)
  })
})
