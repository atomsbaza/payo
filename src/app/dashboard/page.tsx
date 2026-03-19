'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { formatEther, formatUnits } from 'viem'
import { shortAddress } from '@/lib/encode'
import { getValidatedLinks, type SavedLink } from '@/lib/validate-storage'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { Navbar } from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'
import { useLang } from '@/context/LangContext'
import { aggregateTotals } from './aggregation'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const { t, lang } = useLang()
  const [myLinks, setMyLinks] = useState<SavedLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState('')
  const [txHistory, setTxHistory] = useState<UnifiedTx[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'links' | 'history'>('links')

  useEffect(() => {
    setMyLinks(getValidatedLinks())
    setLinksLoading(false)
  }, [])

  useEffect(() => {
    if (!address) return
    setTxLoading(true)
    fetch(`/api/tx/${address}`)
      .then((r) => r.json())
      .then((data) => setTxHistory(data.transactions ?? []))
      .catch(() => setTxHistory([]))
      .finally(() => setTxLoading(false))
  }, [address])

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(''), 2000)
  }

  function handleDelete(idx: number) {
    const updated = myLinks.filter((_, i) => i !== idx)
    setMyLinks(updated)
    localStorage.setItem('myLinks', JSON.stringify(updated))
  }

  function formatDate(ts: string) {
    return new Date(Number(ts) * 1000).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatEthValue(wei: string) {
    try {
      const eth = parseFloat(formatEther(BigInt(wei)))
      return eth.toFixed(eth < 0.001 ? 6 : 4)
    } catch {
      return '0'
    }
  }

  function formatTxValue(tx: UnifiedTx) {
    try {
      if (tx.tokenSymbol && tx.tokenDecimal) {
        const val = parseFloat(formatUnits(BigInt(tx.value), parseInt(tx.tokenDecimal)))
        return val.toFixed(val < 0.001 ? 6 : 4)
      }
      return formatEthValue(tx.value)
    } catch {
      return '0'
    }
  }

  function getTxTokenSymbol(tx: UnifiedTx) {
    return tx.tokenSymbol ?? 'ETH'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isConnected && <WrongNetworkBanner />}

      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">{t.dashTitle}</h1>
          <p className="text-sm text-gray-400">{t.dashSubtitle}</p>
        </div>

        {!isConnected && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-4">🔒</span>
            <p className="text-gray-400 mb-6">{t.connectPrompt}</p>
            <ConnectButton />
          </div>
        )}

        {isConnected && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-xl sm:text-2xl font-bold">{myLinks.length}</p>
                <p className="text-xs sm:text-sm text-gray-400">{t.statsLinks}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-xl sm:text-2xl font-bold text-green-400">{txHistory.filter(tx => tx.direction === 'in').length}</p>
                <p className="text-xs sm:text-sm text-gray-400">{t.statsTx}</p>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-sm sm:text-base font-bold text-indigo-400 truncate">
                  {shortAddress(address ?? '')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400">{t.statsWallet}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 mb-5 sm:mb-6">
              <button
                onClick={() => setActiveTab('links')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'links'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {t.tabLinks}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {t.tabTx}
                {txHistory.length > 0 && (
                  <span className="text-xs bg-indigo-500/30 text-indigo-400 px-1.5 py-0.5 rounded-full">
                    {txHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab: Payment Links */}
            {activeTab === 'links' && (
              <div className="space-y-3">
                {linksLoading ? (
                  <div data-testid="links-skeleton">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-5 w-14 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-40 mb-1" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Skeleton className="h-7 w-14 rounded-lg" />
                            <Skeleton className="h-7 w-14 rounded-lg" />
                            <Skeleton className="h-7 w-14 rounded-lg" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : myLinks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl mb-3">📭</span>
                    <p className="text-gray-400 mb-4 text-sm">{t.emptyLinks}</p>
                    <a
                      href="/create"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors"
                    >
                      {t.emptyLinksBtn}
                    </a>
                  </div>
                ) : (
                  myLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm">
                              {link.amount
                                ? `${link.amount} ${link.token}`
                                : t.noAmount(link.token)}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                              {link.token}
                            </span>
                          </div>
                          {link.memo && (
                            <p className="text-xs text-gray-400 mb-1 truncate">"{link.memo}"</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {shortAddress(link.address)} •{' '}
                            {new Date(link.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                          </p>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 shrink-0">
                          <button
                            onClick={() => handleCopy(link.url)}
                            className="text-xs px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                          >
                            {copiedUrl === link.url ? t.btnCopied : t.btnCopy}
                          </button>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2.5 sm:px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg transition-colors"
                          >
                            {t.btnOpen}
                          </a>
                          <button
                            onClick={() => handleDelete(idx)}
                            className="text-xs px-2.5 sm:px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            {t.btnDelete}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: TX History */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {txLoading ? (
                  <div className="space-y-3" data-testid="tx-skeleton">
                    {/* Summary card skeleton */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2">
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-8 w-40" />
                    </div>
                    {/* 3 tx row skeletons */}
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
                ) : txHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl mb-3">📊</span>
                    <p className="text-gray-400 text-sm">{t.emptyTx}</p>
                    <p className="text-gray-600 text-xs mt-1">{t.emptyTxDesc}</p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const totals = aggregateTotals(txHistory)
                      return Object.entries(totals).map(([token, rawTotal]) => {
                        const decimals = token === 'ETH' ? 18 : (txHistory.find(tx => tx.tokenSymbol === token)?.tokenDecimal ? parseInt(txHistory.find(tx => tx.tokenSymbol === token)!.tokenDecimal!) : 18)
                        const formatted = parseFloat(formatUnits(rawTotal, decimals)).toFixed(4)
                        return (
                          <div key={token} className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2">
                            <p className="text-xs text-indigo-400 mb-1">{t.totalReceivedToken(token)}</p>
                            <p className="text-2xl font-bold">
                              {formatted}{' '}
                              <span className="text-base text-gray-400">{token}</span>
                            </p>
                          </div>
                        )
                      })
                    })()}

                    {txHistory.map((tx) => (
                      <div
                        key={tx.hash}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              tx.direction === 'out'
                                ? 'text-red-400 bg-red-400/10'
                                : 'text-green-400 bg-green-400/10'
                            }`}>
                              {tx.direction === 'out' ? '−' : '+'} {formatTxValue(tx)} {getTxTokenSymbol(tx)}
                            </span>
                            <p className="text-xs text-gray-500 mt-1.5">
                              {tx.direction === 'out'
                                ? t.txTo
                                  ? t.txTo(shortAddress(tx.to ?? ''), formatDate(tx.timeStamp))
                                  : `To ${shortAddress(tx.to ?? '')} • ${formatDate(tx.timeStamp)}`
                                : t.txFrom(shortAddress(tx.from), formatDate(tx.timeStamp))}
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
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
