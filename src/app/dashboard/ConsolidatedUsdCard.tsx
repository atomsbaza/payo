'use client'

import { useMemo } from 'react'
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice'
import { useLang } from '@/context/LangContext'
import Skeleton from '@/components/Skeleton'
import {
  computeConsolidatedUsd,
  formatUsdValue,
  type TokenTotal,
  type PriceMap,
} from './aggregation'

type ConsolidatedUsdCardProps = {
  direction: 'received' | 'sent'
  tokenTotals: TokenTotal[]
  loading: boolean
}

/** Wrapper that calls useCoinGeckoPrice for a single token and reports via callback */
function useTokenPrice(token: string): number | null {
  return useCoinGeckoPrice(token)
}

export default function ConsolidatedUsdCard({
  direction,
  tokenTotals,
  loading,
}: ConsolidatedUsdCardProps) {
  const { t, lang } = useLang()
  const locale = lang === 'th' ? 'th-TH' : 'en-US'

  // Call useCoinGeckoPrice for each known token (hooks must be called unconditionally)
  const ethPrice = useTokenPrice('ETH')
  const usdcPrice = useTokenPrice('USDC')
  const usdtPrice = useTokenPrice('USDT')
  const daiPrice = useTokenPrice('DAI')
  const cbBtcPrice = useTokenPrice('cbBTC')

  const priceMap: PriceMap = useMemo(
    () => ({
      ETH: ethPrice,
      USDC: usdcPrice,
      USDT: usdtPrice,
      DAI: daiPrice,
      cbBTC: cbBtcPrice,
    }),
    [ethPrice, usdcPrice, usdtPrice, daiPrice, cbBtcPrice]
  )

  const result = useMemo(
    () => computeConsolidatedUsd(tokenTotals, priceMap),
    [tokenTotals, priceMap]
  )

  if (loading) {
    return (
      <div
        data-testid={`consolidated-usd-skeleton-${direction}`}
        className={`rounded-xl p-4 mb-2 border ${
          direction === 'received'
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}
      >
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  // Hide when no tokens or no prices available
  if (tokenTotals.length === 0 || !result.hasAnyPrice) {
    return null
  }

  const label =
    direction === 'received'
      ? t.consolidatedUsdReceived
      : t.consolidatedUsdSent

  const formatted = formatUsdValue(result.total, locale)

  return (
    <div
      data-testid={`consolidated-usd-${direction}`}
      className={`rounded-xl p-4 mb-2 border ${
        direction === 'received'
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-red-500/10 border-red-500/20'
      }`}
    >
      <p
        className={`text-xs mb-1 ${
          direction === 'received' ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {label}
      </p>
      <p className="text-2xl font-bold">≈ {formatted}</p>
      {result.excludedTokens.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          {t.consolidatedPartialNote(result.excludedTokens.join(', '))}
        </p>
      )}
    </div>
  )
}
