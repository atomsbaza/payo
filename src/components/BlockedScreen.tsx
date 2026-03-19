'use client'

import Link from 'next/link'
import { useLang } from '@/context/LangContext'

export function BlockedScreen() {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl mb-4">🚫</p>
        <h1 className="text-xl font-bold mb-2">{t.tamperedTitle}</h1>
        <p className="text-gray-400 mb-6">{t.tamperedDesc}</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {t.tamperedGoHome}
        </Link>
        <p className="text-gray-500 text-sm mt-4">{t.tamperedRequestNew}</p>
      </div>
    </div>
  )
}
