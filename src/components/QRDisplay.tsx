'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useState, useRef } from 'react'
import { useLang } from '@/context/LangContext'
import {
  buildLineShareUrl,
  buildWhatsAppShareUrl,
  buildTelegramShareUrl,
  buildShareMessage,
} from '@/lib/shareUrl'

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

    const file = new File([pngBlob], 'transfer-qr.png', { type: 'image/png' })

    // Web Share API level 2 (files) or fallback to download
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(pngBlob)
      a.download = 'transfer-qr.png'
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

      {/* Share_Button_Row */}
      <div className="w-full flex items-center justify-center gap-3">
        {/* LINE */}
        <a
          {...(disableCopy
            ? { 'aria-disabled': 'true' }
            : {
                href: buildLineShareUrl(buildShareMessage(t, url)),
                target: '_blank',
                rel: 'noopener noreferrer',
              })}
          aria-label="Share via LINE"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            disableCopy
              ? 'pointer-events-none opacity-50 cursor-not-allowed border-white/10 text-gray-500'
              : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.83 2 10.5c0 2.97 1.97 5.56 4.91 7.13l-.72 2.62c-.06.22.02.46.2.6a.5.5 0 0 0 .63-.02L10.28 18c.56.08 1.14.12 1.72.12 5.52 0 10-3.83 10-8.5S17.52 2 12 2z" />
          </svg>
          {t.shareViaLine}
        </a>

        {/* WhatsApp */}
        <a
          {...(disableCopy
            ? { 'aria-disabled': 'true' }
            : {
                href: buildWhatsAppShareUrl(buildShareMessage(t, url)),
                target: '_blank',
                rel: 'noopener noreferrer',
              })}
          aria-label="Share via WhatsApp"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            disableCopy
              ? 'pointer-events-none opacity-50 cursor-not-allowed border-white/10 text-gray-500'
              : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7a11 11 0 0 1-4.3-3.8c-.8-1-.8-2.4-.1-3.3.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2-.1.4-.2.6-.2.3-.4.5-.3.3-.1.6.8 1.3 1.7 2.1c1.1.9 1.6 1 2 1 .3 0 .5-.2.7-.4.3-.3.5-.6.8-.6s1.3.6 1.5.7.4.2.5.3c.1.2.1.8-.1 1.4z" />
          </svg>
          {t.shareViaWhatsApp}
        </a>

        {/* Telegram */}
        <a
          {...(disableCopy
            ? { 'aria-disabled': 'true' }
            : {
                href: buildTelegramShareUrl(url, t.shareMessageText),
                target: '_blank',
                rel: 'noopener noreferrer',
              })}
          aria-label="Share via Telegram"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            disableCopy
              ? 'pointer-events-none opacity-50 cursor-not-allowed border-white/10 text-gray-500'
              : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 6.8-1.5 7.1c-.1.5-.4.6-.9.4l-2.4-1.8-1.2 1.1c-.1.1-.3.2-.5.2l.2-2.5 4.7-4.2c.2-.2 0-.3-.3-.1L8.8 13l-2.4-.7c-.5-.2-.5-.5.1-.7l9.4-3.6c.4-.2.8.1.7.7z" />
          </svg>
          {t.shareViaTelegram}
        </a>
      </div>
    </div>
  )
}
