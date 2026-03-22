'use client'

import { useRouter } from 'next/navigation'
import { useLang } from '@/context/LangContext'
import { shortAddress } from '@/lib/encode'

type SuccessViewProps = {
  amount: string
  token: string
  recipientAddress: string
  txHash: `0x${string}`
  blockExplorerUrl: string
  confirmedAt: number
}

export function SuccessView({ amount, token, recipientAddress, txHash, blockExplorerUrl, confirmedAt }: SuccessViewProps) {
  const router = useRouter()
  const { t, lang } = useLang()

  async function handleShare() {
    const text = t.successShareText(amount, token, txHash)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="text-center max-w-sm w-full">
        <div className="text-7xl mb-4">🎉</div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t.paySuccess}</h1>
        <p className="text-gray-400 mb-6">
          {t.paySuccessDesc(amount, token)}
        </p>

        {/* Payment summary */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">{t.successRecipient}</span>
            <span className="font-mono text-gray-200">{shortAddress(recipientAddress)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.successTxHash}</span>
            <span className="font-mono text-gray-200">{shortAddress(txHash)}</span>
          </div>
          {confirmedAt > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t.confirmedAt}</span>
              <span className="text-gray-200 text-xs">
                {new Date(confirmedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <a
            href={`${blockExplorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-3 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm font-medium transition-colors"
          >
            {t.viewOnBasescan}
          </a>
          <button
            onClick={() => router.push('/create')}
            className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {t.successCreateNew}
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-colors"
          >
            {t.successGoHome}
          </button>
          <button
            onClick={handleShare}
            className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-colors"
          >
            {t.successShare}
          </button>
        </div>
      </div>
    </div>
  )
}
