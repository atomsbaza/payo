'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { encodePaymentLink } from '@/lib/encode'
import { TokenSelector } from '@/components/TokenSelector'
import { QRDisplay } from '@/components/QRDisplay'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { baseSepolia } from 'wagmi/chains'

export default function CreatePage() {
  const { address, isConnected } = useAccount()

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
      {/* Wrong network banner */}
      {isConnected && <WrongNetworkBanner />}

      {/* Navbar */}
      <nav className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-indigo-400">⚡</span>
          <span className="font-bold text-base sm:text-lg">Crypto Pay Link</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="/dashboard"
            className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors"
          >
            Dashboard
          </a>
          <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">สร้าง Payment Link</h1>
          <p className="text-sm sm:text-base text-gray-400">
            เหมือน PromptPay แต่เป็น Crypto — แชร์ link แล้วรับเงินได้เลย
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Recipient address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address ผู้รับ
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
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
                  ใช้ของฉัน
                </button>
              )}
            </div>
          </div>

          {/* Token */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Token</label>
            <TokenSelector value={token} onChange={setToken} />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              จำนวน{' '}
              <span className="text-gray-500 font-normal">(ไม่ระบุ = ให้ผู้โอนกรอกเอง)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
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
              Memo / Note <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="เช่น ค่าข้าว, ค่า concert, ค่า freelance"
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
            สร้าง Payment Link ⚡
          </button>
        </div>

        {/* Generated QR */}
        {generatedUrl && (
          <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold mb-4 text-center">
              Payment Link พร้อมแชร์แล้ว! 🎉
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
              ดู links ทั้งหมดใน Dashboard →
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
