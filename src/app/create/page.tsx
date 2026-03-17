'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { encodePaymentLink } from '@/lib/encode'
import { TokenSelector } from '@/components/TokenSelector'
import { QRDisplay } from '@/components/QRDisplay'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { useLang } from '@/context/LangContext'
import { baseSepolia } from 'wagmi/chains'

export default function CreatePage() {
  const { address, isConnected } = useAccount()
  const { t, lang, toggleLang } = useLang()

  const [recipientAddress, setRecipientAddress] = useState('')
  const [token, setToken] = useState('ETH')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')

  function useMyAddress() {
    if (address) setRecipientAddress(address)
  }

  function handleGenerate() {
    const target = recipientAddress.trim()
    if (!target) return

    const encoded = encodePaymentLink({
      address: target,
      token,
      amount: amount.trim(),
      memo: memo.trim(),
      chainId: baseSepolia.id,
    })

    const url = `${window.location.origin}/pay/${encoded}`
    setGeneratedUrl(url)

    // Save to localStorage for dashboard
    const existing = JSON.parse(localStorage.getItem('myLinks') ?? '[]')
    const newLink = { url, address: target, token, amount, memo, createdAt: Date.now() }
    localStorage.setItem('myLinks', JSON.stringify([newLink, ...existing].slice(0, 50)))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isConnected && <WrongNetworkBanner />}

      {/* Navbar */}
      <nav className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-indigo-400">⚡</span>
          <span className="font-bold text-base sm:text-lg">Crypto Pay Link</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleLang}
            className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-gray-300"
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </button>
          <a
            href="/dashboard"
            className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t.navDashboard}
          </a>
          <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t.createTitle}</h1>
          <p className="text-sm sm:text-base text-gray-400">{t.createSubtitle}</p>
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
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
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

          {/* Token */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.labelToken}</label>
            <TokenSelector value={token} onChange={setToken} />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t.labelAmount}
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder={t.amountPlaceholder}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!recipientAddress.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors"
          >
            {t.createButton}
          </button>
        </div>

        {/* Generated QR */}
        {generatedUrl && (
          <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold mb-4 text-center">
              {t.linkReady}
            </h2>
            <QRDisplay url={generatedUrl} />

            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Token</span>
                <p className="font-medium">{token}</p>
              </div>
              {amount && (
                <div>
                  <span className="text-gray-500">Amount</span>
                  <p className="font-medium">{amount} {token}</p>
                </div>
              )}
              {memo && (
                <div className="col-span-2">
                  <span className="text-gray-500">Memo</span>
                  <p className="font-medium">{memo}</p>
                </div>
              )}
            </div>

            <a
              href="/dashboard"
              className="mt-4 block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t.viewDashboard}
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
