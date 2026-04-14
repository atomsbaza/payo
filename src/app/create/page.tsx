'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { encodeTransferLink } from '@/lib/encode'
import { ChainSelector } from '@/components/ChainSelector'
import { TokenSelector } from '@/components/TokenSelector'
import { QRDisplay } from '@/components/QRDisplay'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { Navbar } from '@/components/Navbar'
import { AcceptanceGate } from '@/components/AcceptanceGate'
import { NonCustodialBadge } from '@/components/NonCustodialBadge'
import { OpenSourceBadge } from '@/components/OpenSourceBadge'
import { useLang } from '@/context/LangContext'
import { getChain, getDefaultChainId } from '@/lib/chainRegistry'
import { getDefaultToken } from '@/lib/tokenRegistry'
import { validateEthAddress } from '@/lib/addressValidation'
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice'
import { calculateFiatValue } from '@/lib/fiatCalc'

const GITHUB_REPO_URL = 'https://github.com/atomsbaza/payo'

const EXPIRY_OPTIONS = [
  { value: '0', labelKey: 'expiryNone' as const },
  { value: '1', labelKey: 'expiry1d' as const },
  { value: '7', labelKey: 'expiry7d' as const },
  { value: '30', labelKey: 'expiry30d' as const },
]

// Capture page load time at module level — used for expiry preview calculations
const PAGE_LOAD_TIME = typeof window !== 'undefined' ? Date.now() : 0

export default function CreatePage() {
  const { address, isConnected } = useAccount()
  const { t, lang } = useLang()

  const [recipientAddress, setRecipientAddress] = useState('')
  const [chainId, setChainId] = useState<number>(getDefaultChainId())
  const [token, setToken] = useState(getDefaultToken(getDefaultChainId()))
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [expiryDays, setExpiryDays] = useState('0')
  const [singleUse, setSingleUse] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedUrl, setSavedUrl] = useState('')
  const [createError, setCreateError] = useState('')
  const [accepted, setAccepted] = useState(false)

  // Restore acceptance state from sessionStorage on mount
  useEffect(() => {
    try {
      setAccepted(sessionStorage.getItem('disclaimerAccepted') === 'true')
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — default to false
    }
  }, [])

  function handleAccept(val: boolean) {
    setAccepted(val)
    try {
      if (val) sessionStorage.setItem('disclaimerAccepted', 'true')
      else sessionStorage.removeItem('disclaimerAccepted')
    } catch {
      // silent fail
    }
  }
  // Dynamic QR — recomputes live as form changes (unsigned preview)
  const liveUrl = useMemo(() => {
    const target = recipientAddress.trim()
    if (!target || target.length < 10) return ''
    const expiresAt = expiryDays !== '0'
      ? PAGE_LOAD_TIME + Number(expiryDays) * 24 * 60 * 60 * 1000
      : undefined
    const encoded = encodeTransferLink({
      address: target,
      token,
      amount: amount.trim(),
      memo: memo.trim(),
      chainId,
      ...(expiresAt ? { expiresAt } : {}),
    })
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${encoded}`
  }, [recipientAddress, token, amount, memo, expiryDays, chainId])

  const addressValidation = useMemo(
    () => validateEthAddress(recipientAddress),
    [recipientAddress]
  )

  // CoinGecko fiat price
  const coinGeckoPrice = useCoinGeckoPrice(token)

  const qrRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  useEffect(() => {
    if (liveUrl && !hasScrolled.current && qrRef.current) {
      qrRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      hasScrolled.current = true
    }
  }, [liveUrl])

  function useMyAddress() {
    if (address) setRecipientAddress(address)
  }

  async function handleSave() {
    const target = recipientAddress.trim()
    if (!target || target.length < 10) return
    setCreateError('')

    try {
      const expiresAt = expiryDays !== '0'
        ? Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000
        : undefined

      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: target,
          token,
          amount: amount.trim(),
          memo: memo.trim(),
          chainId,
          ...(expiresAt ? { expiresAt } : {}),
          singleUse,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setCreateError(err.error || `Error ${res.status}`)
        return
      }

      const { url } = await res.json()
      setSavedUrl(url)

      const existing = JSON.parse(localStorage.getItem('myLinks') ?? '[]')
      const newLink = { url, address: target, token, amount, memo, createdAt: Date.now(), singleUse, payCount: 0 }
      localStorage.setItem('myLinks', JSON.stringify([newLink, ...existing].slice(0, 50)))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setCreateError('Network error — please try again')
    }
  }

  const expiryLabel = expiryDays !== '0'
    ? t.expiresOn(new Date(PAGE_LOAD_TIME + Number(expiryDays) * 86400000).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US'))
    : ''

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isConnected && <WrongNetworkBanner expectedChainId={chainId} />}

      <Navbar />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t.createTitle}</h1>
          <p className="text-sm sm:text-base text-gray-400">{t.createSubtitle}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <NonCustodialBadge />
            <OpenSourceBadge repoUrl={GITHUB_REPO_URL} />
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Recipient address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t.labelAddress}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t.addressPlaceholder}
                value={recipientAddress}
                onChange={(e) => { setRecipientAddress(e.target.value); setSaved(false) }}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {recipientAddress && (
                <span
                  className={`shrink-0 flex items-center text-lg ${
                    addressValidation.valid && addressValidation.checksumValid
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                  title={
                    addressValidation.valid && addressValidation.checksumValid
                      ? t.addressValid
                      : t.addressInvalid
                  }
                >
                  {addressValidation.valid && addressValidation.checksumValid ? '✓' : '✗'}
                </span>
              )}
              {isConnected && (
                <button
                  type="button"
                  onClick={useMyAddress}
                  className="shrink-0 px-3 py-2 text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition-colors whitespace-nowrap"
                >
                  {t.useMyWallet}
                </button>
              )}
            </div>
          </div>

          {/* Chain */}
          <div>
            <ChainSelector value={chainId} onChange={(id) => { setChainId(id); setToken(getDefaultToken(id)); setSaved(false) }} />
          </div>

          {/* Token */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.labelToken}</label>
            <TokenSelector value={token} onChange={(v) => { setToken(v); setSaved(false) }} chainId={chainId} />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t.labelAmount}
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                placeholder={t.amountPlaceholder}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setSaved(false) }}
                min="0"
                step="any"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                {token}
              </span>
            </div>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t.labelMemo}
            </label>
            <input
              type="text"
              placeholder={t.memoPlaceholder}
              value={memo}
              onChange={(e) => { setMemo(e.target.value); setSaved(false) }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t.labelExpiry}
            </label>
            <div className="flex gap-2 flex-wrap">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setExpiryDays(opt.value); setSaved(false) }}
                  className={`px-3 py-2 text-xs rounded-xl border transition-colors ${
                    expiryDays === opt.value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {t[opt.labelKey]}
                </button>
              ))}
            </div>
            {expiryLabel && (
              <p className="text-xs text-amber-400 mt-2">⏰ {expiryLabel}</p>
            )}
          </div>

          {/* Single-use toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-300">
                {t.labelSingleUse}
              </label>
              <p className="text-xs text-gray-500 mt-0.5">{t.singleUseHint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={singleUse}
              onClick={() => setSingleUse(!singleUse)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                singleUse ? 'bg-indigo-600' : 'bg-white/10'
              }`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                singleUse ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Dynamic QR — shows as soon as address is valid */}
        {liveUrl ? (
          <div ref={qrRef} className="mt-6 sm:mt-8 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-[1px]">
          <div className="p-5 sm:p-6 bg-gray-950 rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold mb-4 text-center">
              {t.linkReady}
            </h2>
            <QRDisplay url={savedUrl || liveUrl} disableCopy={!savedUrl} />

            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Chain</span>
                <p className="font-medium">{getChain(chainId)?.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Token</span>
                <p className="font-medium">{token}</p>
              </div>
              {amount && (
                <div>
                  <span className="text-gray-500">Amount</span>
                  <p className="font-medium">
                    {amount} {token}
                    {coinGeckoPrice !== null && (() => {
                      const fiat = calculateFiatValue(amount, coinGeckoPrice)
                      return fiat ? <span className="text-gray-400 text-sm font-normal ml-2">≈ ${fiat}</span> : null
                    })()}
                  </p>
                </div>
              )}
              {memo && (
                <div className="col-span-2">
                  <span className="text-gray-500">Memo</span>
                  <p className="font-medium">{memo}</p>
                </div>
              )}
              {expiryLabel && (
                <div className="col-span-2">
                  <span className="text-gray-500">{t.labelExpiry}</span>
                  <p className="font-medium text-amber-400 text-xs">{expiryLabel}</p>
                </div>
              )}
            </div>

            {/* Acceptance Gate */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <AcceptanceGate accepted={accepted} onChange={handleAccept} />
            </div>

            {/* Save to dashboard button */}
            <button
              onClick={handleSave}
              disabled={!accepted}
              className={`mt-4 w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                saved
                  ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                  : accepted
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              {saved ? t.saveButton : t.createButton}
            </button>

            <a
              href="/dashboard"
              className="mt-3 block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t.viewDashboard}
            </a>
          </div>
          </div>
        ) : (
          <div className="mt-6 sm:mt-8 p-5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-600 min-h-[160px]">
            <span className="text-3xl">📲</span>
            <p className="text-sm">{t.addressPlaceholder} → QR</p>
          </div>
        )}
      </main>
    </div>
  )
}
