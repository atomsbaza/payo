'use client'

import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useLang } from '@/context/LangContext'

const NAV_LINKS = [
  { href: '/', labelKey: 'navHome' as const },
  { href: '/create', labelKey: 'navCreateLink' as const },
  { href: '/dashboard', labelKey: 'navDashboard' as const },
  { href: '/dashboard/fees', labelKey: 'navFees' as const },
]

export function Navbar() {
  const pathname = usePathname()
  const { t, lang, toggleLang } = useLang()

  return (
    <nav className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xl font-bold text-indigo-400">⚡</span>
        <span className="font-bold text-base sm:text-lg">{t.brand.replace('⚡ ', '')}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={toggleLang}
          className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-gray-300"
        >
          {lang === 'th' ? 'EN' : 'TH'}
        </button>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href
          return (
            <a
              key={link.href}
              href={link.href}
              data-href={link.href}
              className={`text-xs sm:text-sm transition-colors ${
                isActive ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t[link.labelKey]}
            </a>
          )
        })}
        <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
      </div>
    </nav>
  )
}
