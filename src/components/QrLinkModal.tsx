'use client'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef } from 'react'
import type { SavedLink } from '@/lib/validate-storage'

type Props = {
  link: SavedLink
  onClose: () => void
}

export function QrLinkModal({ link, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div ref={dialogRef} tabIndex={-1} className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">QR Code</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-white rounded-xl">
            <QRCodeSVG value={link.url} size={200} />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">
            {link.amount ? `${link.amount} ${link.token}` : link.token}
          </p>
          {link.memo && <p className="text-xs text-gray-400">&ldquo;{link.memo}&rdquo;</p>}
          <p className="text-xs text-gray-500 break-all">{link.url}</p>
        </div>
      </div>
    </div>
  )
}
