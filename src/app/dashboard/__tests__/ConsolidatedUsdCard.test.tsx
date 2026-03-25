// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { translations } from '@/lib/i18n'
import type { TokenTotal } from '../aggregation'

// --- Mocks ---

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: translations.en,
    toggleLang: () => {},
  }),
}))

// Mock Skeleton as a simple div that passes through className
vi.mock('@/components/Skeleton', () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}))

// Mock useCoinGeckoPrice — returns price based on token symbol
const mockPrices: Record<string, number | null> = {}
vi.mock('@/hooks/useCoinGeckoPrice', () => ({
  useCoinGeckoPrice: (token: string) => mockPrices[token] ?? null,
}))

import ConsolidatedUsdCard from '../ConsolidatedUsdCard'

function setMockPrices(prices: Record<string, number | null>) {
  Object.keys(mockPrices).forEach((k) => delete mockPrices[k])
  Object.assign(mockPrices, prices)
}

/**
 * Unit tests for ConsolidatedUsdCard component
 *
 * Validates: Requirements 2.3, 2.4, 5.1, 5.2
 */
describe('ConsolidatedUsdCard', () => {
  it('shows loading skeleton when loading=true (received)', () => {
    setMockPrices({ ETH: 3000, USDC: 1, USDT: 1, DAI: 1, cbBTC: 60000 })
    const totals: TokenTotal[] = [
      { token: 'ETH', rawTotal: 1000000000000000000n, decimals: 18 },
    ]

    const { container } = render(
      <ConsolidatedUsdCard direction="received" tokenTotals={totals} loading={true} />
    )

    expect(screen.getByTestId('consolidated-usd-skeleton-received')).toBeDefined()
    // Should render skeleton elements
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows loading skeleton when loading=true (sent)', () => {
    setMockPrices({ ETH: 3000, USDC: 1, USDT: 1, DAI: 1, cbBTC: 60000 })
    const totals: TokenTotal[] = [
      { token: 'ETH', rawTotal: 500000000000000000n, decimals: 18 },
    ]

    render(
      <ConsolidatedUsdCard direction="sent" tokenTotals={totals} loading={true} />
    )

    expect(screen.getByTestId('consolidated-usd-skeleton-sent')).toBeDefined()
  })

  it('returns null when tokenTotals is empty', () => {
    setMockPrices({ ETH: 3000, USDC: 1, USDT: 1, DAI: 1, cbBTC: 60000 })

    const { container } = render(
      <ConsolidatedUsdCard direction="received" tokenTotals={[]} loading={false} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('returns null when all token prices are null (hasAnyPrice === false)', () => {
    setMockPrices({ ETH: null, USDC: null, USDT: null, DAI: null, cbBTC: null })
    const totals: TokenTotal[] = [
      { token: 'ETH', rawTotal: 1000000000000000000n, decimals: 18 },
      { token: 'USDC', rawTotal: 1000000n, decimals: 6 },
    ]

    const { container } = render(
      <ConsolidatedUsdCard direction="received" tokenTotals={totals} loading={false} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('shows partial indicator when some tokens have no price', () => {
    // ETH has price, DAI does not
    setMockPrices({ ETH: 3000, USDC: null, USDT: null, DAI: null, cbBTC: null })
    const totals: TokenTotal[] = [
      { token: 'ETH', rawTotal: 1000000000000000000n, decimals: 18 },
      { token: 'DAI', rawTotal: 5000000000000000000n, decimals: 18 },
    ]

    render(
      <ConsolidatedUsdCard direction="received" tokenTotals={totals} loading={false} />
    )

    // The card should be visible since ETH has a price
    expect(screen.getByTestId('consolidated-usd-received')).toBeDefined()

    // The partial note should mention DAI
    const noteText = translations.en.consolidatedPartialNote('DAI')
    expect(screen.getByText(noteText)).toBeDefined()
  })
})
