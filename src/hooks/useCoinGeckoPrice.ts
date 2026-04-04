import { useState, useEffect } from 'react'

/** Token symbol → CoinGecko ID mapping */
const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  cbBTC: 'bitcoin',
}

/** In-memory cache: { [coinId]: { price, fetchedAt } } */
const priceCache: Map<string, { price: number; fetchedAt: number }> = new Map()
const CACHE_TTL = 60_000 // 60 seconds

/**
 * Custom hook to fetch the USD price of a token from CoinGecko free tier.
 * Returns number | null — null while loading or on error.
 * Requirements: 2.2, 2.4, 2.5, 2.8
 */
export function useCoinGeckoPrice(tokenSymbol: string): number | null {
  const [price, setPrice] = useState<number | null>(() => {
    const coinId = COINGECKO_IDS[tokenSymbol]
    if (!coinId) return null
    const cached = priceCache.get(coinId)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.price
    return null
  })

  useEffect(() => {
    const coinId = COINGECKO_IDS[tokenSymbol]
    if (!coinId) return

    const cached = priceCache.get(coinId)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return
    }

    let cancelled = false
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const p = data[coinId]?.usd
        if (typeof p === 'number') {
          priceCache.set(coinId, { price: p, fetchedAt: Date.now() })
          setPrice(p)
        }
      })
      .catch(() => {
        /* graceful degradation — hide fiat display */
      })

    return () => {
      cancelled = true
    }
  }, [tokenSymbol])

  return price
}
