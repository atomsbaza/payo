'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useState, useRef } from 'react'
import { useLang } from '@/context/LangContext'

type Props = {
  url: string
  disableCopy?: boolean
}

export function QRDisplay({ url, disableCopy }: Props) {
  const [copied, setCopied] = useState(false)
  const { t } = useLang()
  const qrSvgRef = useRef<HTMLDivElement>(null)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShareQR() {
    if (!qrSvgRef.current) return

    const svg = qrSvgRef.current.querySelector('svg')
    if (!svg) return

    // SVG → Canvas → PNG
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!

    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(blob)

    await new Promise<void>((resolve) => {
      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 512, 512)
        ctx.drawImage(img, 0, 0, 512, 512)
        URL.revokeObjectURL(svgUrl)
        resolve()
      }
      img.src = svgUrl
    })

    const pngBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png')
    )

    const file = new File([pngBlob], 'payment-qr.png', { type: 'image/png' })

    // Web Share API level 2 (files) or fallback to download
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(pngBlob)
      a.download = 'payment-qr.png'
      a.click()
      URL.revokeObjectURL(a.href)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={qrSvgRef} className="p-4 bg-white rounded-2xl">
        <QRCodeSVG value={url} size={200} />
      </div>

      <div className="w-full">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="flex-1 text-xs text-gray-400 truncate">
            {disableCopy ? t.createToShare ?? 'Create link to share' : url}
          </span>
          <button
            onClick={handleCopy}
            disabled={disableCopy}
            className="shrink-0 text-xs px-3 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            {copied ? t.copiedLink : t.copyLink}
          </button>
          <button
            onClick={handleShareQR}
            disabled={disableCopy}
            className="shrink-0 text-xs px-3 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            {t.shareQR}
          </button>
        </div>
      </div>
    </div>
  )
}
