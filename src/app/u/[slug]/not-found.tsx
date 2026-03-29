'use client'

import { Navbar } from '@/components/Navbar'
import { useLang } from '@/context/LangContext'

export default function ProfileNotFound() {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <div className="text-center">
          <p className="text-6xl mb-4">👤</p>
          <h1 className="text-xl font-bold mb-2">{t.profileNotFound}</h1>
          <p className="text-gray-400 mb-6">{t.profileTitle}</p>
          <a
            href="/"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {t.tamperedGoHome}
          </a>
        </div>
      </div>
    </div>
  )
}
