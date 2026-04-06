'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { formatEther, formatUnits } from 'viem'
import { shortAddress } from '@/lib/encode'
import { getValidatedLinks, type SavedLink } from '@/lib/validate-storage'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { Navbar } from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'
import { QrLinkModal } from '@/components/QrLinkModal'
import { useLang } from '@/context/LangContext'
import { useIsCompanyWallet } from '@/hooks/useIsCompanyWallet'
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice'
import { UsernameSection } from './UsernameSection'
import {
  aggregateTotals,
  filterTransactions,
  getLinkStatus,
  aggregateSentTotals,
  aggregateByDay,
  buildCsvContent,
  matchTxToLink,
  getVisibleTabs,
  aggregateFeeTotals,
} from './aggregation'
import type { DashboardTab, TokenTotal } from './aggregation'
import ConsolidatedUsdCard from './ConsolidatedUsdCard'
import type { UnifiedTx } from '@/app/api/tx/[address]/route'
import type { FeeTx } from '@/app/api/fees/[address]/route'
import { getSupportedChains } from '@/lib/chainRegistry'

const COMPANY_WALLET = process.env.NEXT_PUBLIC_COMPANY_WALLET

/** 5.1 — Fiat value display component */
function FiatLine({ token, formattedAmount }: { token: string; formattedAmount: string }) {
  const price = useCoinGeckoPrice(token)
  if (price === null) return null
  const fiat = (parseFloat(formattedAmount) * price).toFixed(2)
  return <p className="text-xs text-gray-500">≈ ${fiat}</p>
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const { t, lang } = useLang()
  const { isCompany } = useIsCompanyWallet()
  const [myLinks, setMyLinks] = useState<SavedLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState('')
  const [txHistory, setTxHistory] = useState<UnifiedTx[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('links')
  const [qrLink, setQrLink] = useState<SavedLink | null>(null)

  /** Fee data state (lazy-loaded when fees tab is active) */
  const [feeTxs, setFeeTxs] = useState<FeeTx[]>([])
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeError, setFeeError] = useState(false)

  /** 5.2 — Filter state */
  const [tokenFilter, setTokenFilter] = useState<string | null>(null)
  const [dirFilter, setDirFilter] = useState<'in' | 'out' | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  /** 5.2 — Derived filtered transactions */
  const filteredTxs = useMemo(() => filterTransactions(txHistory, {
    token: tokenFilter,
    direction: dirFilter,
    startDate: startDate ? Math.floor(new Date(startDate).getTime() / 1000) : null,
    endDate: endDate ? Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000) : null,
  }), [txHistory, tokenFilter, dirFilter, startDate, endDate])

  /** 5.2 — Token dropdown options from actual data */
  const tokenOptions = useMemo(() => {
    const tokens = new Set(txHistory.map(tx => tx.tokenSymbol ?? 'ETH'))
    return Array.from(tokens)
  }, [txHistory])

  /** 5.5 — Daily chart data */
  const dailyData = useMemo(() => aggregateByDay(filteredTxs), [filteredTxs])
  const maxTotal = dailyData.reduce((m, d) => d.total > m ? d.total : m, 0n)

  /** Consolidated USD — received token totals */
  const receivedTokenTotals: TokenTotal[] = useMemo(() => {
    const totals = aggregateTotals(filteredTxs)
    return Object.entries(totals).map(([token, rawTotal]) => {
      const decimals = token === 'ETH' ? 18 : token === 'cbBTC' ? 8 : (txHistory.find(tx => tx.tokenSymbol === token)?.tokenDecimal ? parseInt(txHistory.find(tx => tx.tokenSymbol === token)!.tokenDecimal!) : 18)
      return { token, rawTotal, decimals }
    })
  }, [filteredTxs, txHistory])

  /** Consolidated USD — sent token totals */
  const sentTokenTotals: TokenTotal[] = useMemo(() => {
    const totals = aggregateSentTotals(filteredTxs)
    return Object.entries(totals).map(([token, rawTotal]) => {
      const decimals = token === 'ETH' ? 18 : token === 'cbBTC' ? 8 : (txHistory.find(tx => tx.tokenSymbol === token)?.tokenDecimal ? parseInt(txHistory.find(tx => tx.tokenSymbol === token)!.tokenDecimal!) : 18)
      return { token, rawTotal, decimals }
    })
  }, [filteredTxs, txHistory])

  useEffect(() => {
    setMyLinks(getValidatedLinks())
    setLinksLoading(false)
  }, [])

  // TX history fetch disabled — section hidden, avoid unnecessary DB writes
  // useEffect(() => { ... fetch /api/tx ... }, [address])

  /** Lazy fetch fee transactions when fees tab is active and user is company wallet */
  useEffect(() => {
    if (activeTab !== 'fees' || !isCompany || !COMPANY_WALLET) return
    setFeeLoading(true)
    setFeeError(false)
    const chains = getSupportedChains()
    Promise.all(
      chains.map(c =>
        fetch(`/api/fees/${COMPANY_WALLET}?chainId=${c.chainId}`)
          .then(r => r.json())
          .then(data => data.transactions ?? [])
          .catch(() => [])
      )
    )
      .then(results => setFeeTxs(results.flat()))
      .catch(() => { setFeeTxs([]); setFeeError(true) })
      .finally(() => setFeeLoading(false))
  }, [activeTab, isCompany])

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

  /** 5.6 — CSV export handler */
  function handleExportCsv() {
    const csv = buildCsvContent(filteredTxs)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payo-tx-${address}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isConnected && <WrongNetworkBanner />}

      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">{isCompany ? t.companyDashTitle : t.dashTitle}</h1>
          <p className="text-sm text-gray-400">{isCompany ? t.companyDashSubtitle : t.dashSubtitle}</p>
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
              {/* TX received stat hidden — buggy */}
              <div className="col-span-2 sm:col-span-1 bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-sm sm:text-base font-bold text-indigo-400 truncate">
                  {shortAddress(address ?? '')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400">{t.statsWallet}</p>
              </div>
              {isCompany && feeTxs.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                  <p className="text-xl font-bold text-yellow-400">{feeTxs.length}</p>
                  <p className="text-xs text-gray-400">Fee Transactions</p>
                </div>
              )}
            </div>

            {/* Username Section */}
            {address && <UsernameSection address={address} />}

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
              {/* TX History tab hidden — buggy */}
              {isCompany && (
                <button
                  onClick={() => setActiveTab('fees')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'fees'
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  Fees
                </button>
              )}
              {/* Export CSV hidden with TX history tab */}
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
                            {/* 5.4 — Link Status Badge */}
                            {(() => {
                              const status = getLinkStatus(link.expiryDate, Date.now())
                              return (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  status === 'active'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {status === 'active' ? 'Active' : 'Expired'}
                                </span>
                              )
                            })()}
                            {/* 5.3 — Single-use Badge (Invoice / Paid) */}
                            {link.singleUse && (
                              (link.payCount ?? 0) >= 1 ? (
                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                                  {t.badgePaid}
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                  {t.badgeInvoice}
                                </span>
                              )
                            )}
                          </div>
                          {link.memo && (
                            <p className="text-xs text-gray-400 mb-1 truncate">&ldquo;{link.memo}&rdquo;</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {shortAddress(link.address)} •{' '}
                            {new Date(link.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                          </p>
                          {/* matchTxToLink indicator hidden — TX receive buggy */}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 shrink-0">
                          <button
                            onClick={() => setQrLink(link)}
                            className="text-xs px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                            aria-label="Show QR code"
                          >
                            QR
                          </button>
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

            {/* Tab: Fees (company wallet only) */}
            {activeTab === 'fees' && (
              <div className="space-y-3">
                {feeLoading ? (
                  <div className="space-y-3" data-testid="fee-skeleton">
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2">
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-8 w-40" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 mb-2">
                      <Skeleton className="h-5 w-20 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
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
                ) : feeError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl mb-3">⚠️</span>
                    <p className="text-gray-400 text-sm">{t.feeLoadError}</p>
                    <button
                      onClick={() => {
                        setFeeError(false)
                        setFeeLoading(true)
                        const chains = getSupportedChains()
                        Promise.all(
                          chains.map(c =>
                            fetch(`/api/fees/${COMPANY_WALLET}?chainId=${c.chainId}`)
                              .then(r => r.json())
                              .then(data => data.transactions ?? [])
                              .catch(() => [])
                          )
                        )
                          .then(results => setFeeTxs(results.flat()))
                          .catch(() => { setFeeTxs([]); setFeeError(true) })
                          .finally(() => setFeeLoading(false))
                      }}
                      className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors"
                    >
                      {t.feeRetry}
                    </button>
                  </div>
                ) : feeTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl mb-3">📊</span>
                    <p className="text-gray-400 text-sm">{t.feeNoTx}</p>
                    <p className="text-gray-600 text-xs mt-1">{t.feeNoTxDesc}</p>
                  </div>
                ) : (
                  <>
                    {/* Aggregated fee totals per token */}
                    {(() => {
                      const { totals, count } = aggregateFeeTotals(feeTxs)
                      return (
                        <>
                          {Object.entries(totals).map(([token, rawTotal]) => {
                            const decimals =
                              token === 'ETH'
                                ? 18
                                : parseInt(
                                    feeTxs.find((tx) => tx.tokenSymbol === token)?.tokenDecimal ?? '18'
                                  )
                            const formatted = parseFloat(formatUnits(rawTotal, decimals)).toFixed(4)
                            return (
                              <div
                                key={token}
                                className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2"
                              >
                                <p className="text-xs text-indigo-400 mb-1">{t.feeTotalCollected(token)}</p>
                                <p className="text-2xl font-bold">
                                  {formatted} <span className="text-base text-gray-400">{token}</span>
                                </p>
                              </div>
                            )
                          })}

                          {/* Fee transaction count */}
                          <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 mb-2">
                            <p className="text-xl sm:text-2xl font-bold text-green-400">{count}</p>
                            <p className="text-xs sm:text-sm text-gray-400">{t.feeBearingTx}</p>
                          </div>
                        </>
                      )
                    })()}

                    {/* Individual fee transactions */}
                    {feeTxs.map((tx) => {
                      let feeDisplay: string
                      try {
                        if (tx.tokenSymbol && tx.tokenDecimal) {
                          const val = parseFloat(formatUnits(BigInt(tx.feeAmount), parseInt(tx.tokenDecimal)))
                          feeDisplay = val.toFixed(val < 0.001 ? 6 : 4)
                        } else {
                          const eth = parseFloat(formatUnits(BigInt(tx.feeAmount), 18))
                          feeDisplay = eth.toFixed(eth < 0.001 ? 6 : 4)
                        }
                      } catch {
                        feeDisplay = '0'
                      }
                      const tokenSymbol = tx.tokenSymbol ?? 'ETH'
                      return (
                        <div
                          key={tx.hash}
                          className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-green-400 text-xs font-semibold bg-green-400/10 px-2 py-0.5 rounded-full">
                                + {feeDisplay} {tokenSymbol}
                              </span>
                              <p className="text-xs text-gray-500 mt-1.5">
                                {t.feeFrom(shortAddress(tx.payer), formatDate(tx.timeStamp))}
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
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* Tab: TX History — hidden, buggy */}
            {false && activeTab === 'history' && (
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
                    {/* 5.2 — Filter controls */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 items-center">
                      <select
                        value={tokenFilter ?? ''}
                        onChange={(e) => setTokenFilter(e.target.value || null)}
                        className="text-xs bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-white"
                      >
                        <option value="">All Tokens</option>
                        {tokenOptions.map(tok => (
                          <option key={tok} value={tok}>{tok}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {(['all', 'in', 'out'] as const).map(dir => (
                          <button
                            key={dir}
                            onClick={() => setDirFilter(dir === 'all' ? null : dir)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                              (dir === 'all' && dirFilter === null) || dirFilter === dir
                                ? 'bg-indigo-500/30 text-indigo-400'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                            }`}
                          >
                            {dir === 'all' ? 'All' : dir === 'in' ? 'Incoming' : 'Outgoing'}
                          </button>
                        ))}
                      </div>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-xs bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-white"
                        placeholder="Start"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-xs bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-white"
                        placeholder="End"
                      />
                    </div>

                    {/* Consolidated USD — Received */}
                    <ConsolidatedUsdCard direction="received" tokenTotals={receivedTokenTotals} loading={txLoading} />

                    {/* 5.1 + 5.2 — Received totals (using filteredTxs) */}
                    {(() => {
                      const totals = aggregateTotals(filteredTxs)
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
                            {/* 5.1 — Fiat value display */}
                            <FiatLine token={token} formattedAmount={formatted} />
                          </div>
                        )
                      })
                    })()}

                    {/* Consolidated USD — Sent */}
                    <ConsolidatedUsdCard direction="sent" tokenTotals={sentTokenTotals} loading={txLoading} />

                    {/* 5.3 — Sent Totals card */}
                    {(() => {
                      const sentTotals = aggregateSentTotals(filteredTxs)
                      return Object.entries(sentTotals).map(([token, rawTotal]) => {
                        const decimals = token === 'ETH' ? 18 : (txHistory.find(tx => tx.tokenSymbol === token)?.tokenDecimal ? parseInt(txHistory.find(tx => tx.tokenSymbol === token)!.tokenDecimal!) : 18)
                        const formatted = parseFloat(formatUnits(rawTotal, decimals)).toFixed(4)
                        return (
                          <div key={`sent-${token}`} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-2">
                            <p className="text-xs text-orange-400 mb-1">Total {token} sent</p>
                            <p className="text-2xl font-bold text-red-400">
                              {formatted}{' '}
                              <span className="text-base text-gray-400">{token}</span>
                            </p>
                            {/* 5.1/5.3 — Fiat value for sent totals */}
                            <FiatLine token={token} formattedAmount={formatted} />
                          </div>
                        )
                      })
                    })()}

                    {/* 5.5 — Daily Receiving Chart */}
                    {dailyData.length > 0 && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2">
                        <p className="text-xs text-gray-400 mb-3">Daily Receiving (last 14 days)</p>
                        <div className="flex items-end gap-1 h-32">
                          {dailyData.slice(-14).map(({ date, total }) => (
                            <div key={date} className="flex flex-col items-center gap-1 flex-1">
                              <div
                                className="w-6 bg-indigo-500 rounded-t"
                                style={{ height: maxTotal > 0n ? `${Math.max(2, Math.round(Number((total * 128n) / maxTotal)))}px` : '0px' }}
                              />
                              <span className="text-[10px] text-gray-500 -rotate-45">{date.slice(5)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5.2 — Empty state when filters match nothing */}
                    {filteredTxs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <span className="text-3xl mb-2">🔍</span>
                        <p className="text-gray-400 text-sm">No transactions match the current filters</p>
                      </div>
                    ) : (
                      filteredTxs.map((tx) => (
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
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* 6.2 — QR Modal */}
      {qrLink && (
        <QrLinkModal link={qrLink} onClose={() => setQrLink(null)} />
      )}
    </div>
  )
}
