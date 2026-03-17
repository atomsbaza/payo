'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useLang } from '@/context/LangContext'

type Props = {
  url: string
}

export function QRDisplay({ url }: Props) {
  const [copied, setCopied] = useState(false)
  const { t } = useLang()

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl">
        <QRCodeSVG value={url} size={200} />
      </div>

      <div className="w-full">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="flex-1 text-xs text-gray-400 truncate">{url}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            {copied ? t.copiedLink : t.copyLink}
          </button>
        </div>
      </div>
    </div>
  )
}
