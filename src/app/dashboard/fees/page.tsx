'use client'

import { useEffect, useState } from 'react'
import { formatEther, formatUnits } from 'viem'
import { shortAddress } from '@/lib/encode'
import { COMPANY_WALLET } from '@/lib/contract'
import { Navbar } from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { useLang } from '@/context/LangContext'
import { aggregateFeeTotals } from './aggregation'
import type { FeeTx } from '@/app/api/fees/[address]/route'

export default function FeeDashboardPage() {
  const { t, lang } = useLang()
  const [transactions, setTransactions] = useState<FeeTx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!COMPANY_WALLET) return
    fetch(`/api/fees/${COMPANY_WALLET}`)
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => {
        setTransactions([])
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  function formatDate(ts: string) {
    return new Date(Number(ts) * 1000).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatFeeValue(tx: FeeTx) {
    try {
      if (tx.tokenSymbol && tx.tokenDecimal) {
        const val = parseFloat(formatUnits(BigInt(tx.feeAmount), parseInt(tx.tokenDecimal)))
        return val.toFixed(val < 0.001 ? 6 : 4)
      }
      const eth = parseFloat(formatEther(BigInt(tx.feeAmount)))
      return eth.toFixed(eth < 0.001 ? 6 : 4)
    } catch {
      return '0'
    }
  }

  function getTokenSymbol(tx: FeeTx) {
    return tx.tokenSymbol ?? 'ETH'
  }

  const { totals, count } = aggregateFeeTotals(transactions)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <WrongNetworkBanner />
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">{t.feeDashTitle}</h1>
          <p className="text-sm text-gray-400">
            {t.feeDashSubtitle(shortAddress(COMPANY_WALLET ?? ''))}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3" data-testid="fee-skeleton">
            {/* Summary card skeletons */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 mb-2">
              <Skeleton className="h-5 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            {/* Transaction row skeletons */}
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-5 w-28 mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="text-gray-400 text-sm">{t.feeLoadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {t.feeRetry}
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">📊</span>
            <p className="text-gray-400 text-sm">No fee transactions yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Fee transactions will appear here once payments are processed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Aggregated totals per token */}
            {Object.entries(totals).map(([token, rawTotal]) => {
              const decimals =
                token === 'ETH'
                  ? 18
                  : parseInt(
                      transactions.find((tx) => tx.tokenSymbol === token)?.tokenDecimal ?? '18'
                    )
              const formatted = parseFloat(formatUnits(rawTotal, decimals)).toFixed(4)
              return (
                <div
                  key={token}
                  className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2"
                >
                  <p className="text-xs text-indigo-400 mb-1">Total {token} fees collected</p>
                  <p className="text-2xl font-bold">
                    {formatted} <span className="text-base text-gray-400">{token}</span>
                  </p>
                </div>
              )
            })}

            {/* Transaction count */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 mb-2">
              <p className="text-xl sm:text-2xl font-bold text-green-400">{count}</p>
              <p className="text-xs sm:text-sm text-gray-400">Fee-bearing transactions</p>
            </div>

            {/* Individual transactions */}
            {transactions.map((tx) => (
              <div
                key={tx.hash}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-green-400 text-xs font-semibold bg-green-400/10 px-2 py-0.5 rounded-full">
                      + {formatFeeValue(tx)} {getTokenSymbol(tx)}
                    </span>
                    <p className="text-xs text-gray-500 mt-1.5">
                      From {shortAddress(tx.payer)} • {formatDate(tx.timeStamp)}
                    </p>
                  </div>
                  <a
                    href={`https://sepolia.basescan.org/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
