'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useLang } from '@/context/LangContext'
import { PayoLogo } from '@/components/PayoLogo'
import { useIsCompanyWallet } from '@/hooks/useIsCompanyWallet'

const NAV_LINKS = [
  { href: '/', labelKey: 'navHome' as const },
  { href: '/create', labelKey: 'navCreateLink' as const },
  { href: '/dashboard', labelKey: 'navDashboard' as const },
]

/**
 * Filters and transforms NAV_LINKS based on company wallet status.
 * - Changes dashboard labelKey to `navCompanyDashboard` when isCompany is true
 */
export function getFilteredLinks(isCompany: boolean) {
  return NAV_LINKS
    .map((link) =>
      isCompany && link.href === '/dashboard'
        ? { ...link, labelKey: 'navCompanyDashboard' as const }
        : link
    )
}

export function Navbar() {
  const pathname = usePathname()
  const { t, lang, toggleLang } = useLang()
  const { isCompany } = useIsCompanyWallet()
  const links = getFilteredLinks(isCompany)

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
        {links.map((link) => {
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
