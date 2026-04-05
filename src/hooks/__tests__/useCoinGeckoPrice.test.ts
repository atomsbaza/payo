// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Reset module between tests to clear in-memory price cache
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCoinGeckoPrice', () => {
  it('returns null initially for known token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ethereum: { usd: 3000 } }),
    } as Response)

    const { useCoinGeckoPrice } = await import('../useCoinGeckoPrice')
    const { result } = renderHook(() => useCoinGeckoPrice('ETH'))
    expect(result.current).toBeNull()
  })

  it('returns price after fetch resolves', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ethereum: { usd: 3000 } }),
    } as Response)

    const { useCoinGeckoPrice } = await import('../useCoinGeckoPrice')
    const { result } = renderHook(() => useCoinGeckoPrice('ETH'))
    await waitFor(() => expect(result.current).toBe(3000))
  })

  it('returns null for unknown token symbol', async () => {
    const { useCoinGeckoPrice } = await import('../useCoinGeckoPrice')
    const { result } = renderHook(() => useCoinGeckoPrice('UNKNOWN'))
    expect(result.current).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null on fetch error (graceful degradation)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    const { useCoinGeckoPrice } = await import('../useCoinGeckoPrice')
    const { result } = renderHook(() => useCoinGeckoPrice('ETH'))
    // wait for fetch to settle
    await new Promise(r => setTimeout(r, 100))
    expect(result.current).toBeNull()
  })

  it('maps USDC to usd-coin coingecko id', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ 'usd-coin': { usd: 1.0 } }),
    } as Response)

    const { useCoinGeckoPrice } = await import('../useCoinGeckoPrice')
    const { result } = renderHook(() => useCoinGeckoPrice('USDC'))
    await waitFor(() => expect(result.current).toBe(1.0))
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('usd-coin')
  })
})
