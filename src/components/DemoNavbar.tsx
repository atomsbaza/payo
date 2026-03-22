'use client'

import Link from 'next/link'
import { useLang } from '@/context/LangContext'
import { PayoLogo } from '@/components/PayoLogo'

export function DemoNavbar() {
  const { lang, toggleLang } = useLang()

  return (
    <nav className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <PayoLogo size={24} />
        <span className="font-bold text-base sm:text-lg">Payo</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={toggleLang}
          className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-gray-300"
        >
          {lang === 'th' ? 'EN' : 'TH'}
        </button>
      </div>
    </nav>
  )
}
