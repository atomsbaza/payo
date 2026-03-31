'use client'

import { useState } from 'react'
import { translations } from '@/lib/i18n'
import type { ReceiptData } from '@/lib/receiptData'
import { receiptFilename } from '@/lib/receiptData'

type DownloadReceiptButtonProps = {
  receiptData: ReceiptData
  locale: 'th' | 'en'
}

export function DownloadReceiptButton({ receiptData, locale }: DownloadReceiptButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = translations[locale]

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      const { generateReceiptPdf } = await import('@/lib/generateReceiptPdf')
      const doc = await generateReceiptPdf(receiptData, locale)

      const arrayBuffer = doc.output('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = receiptFilename(receiptData.txHash)
      link.click()

      URL.revokeObjectURL(url)
    } catch {
      setError(t.receiptError)
    } finally {
      setLoading(false)
    }
  }

  const label = loading
    ? t.receiptGenerating
    : error
      ? error
      : t.receiptDownload

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full px-4 py-3 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  )
}
