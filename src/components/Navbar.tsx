'use client'

import { useState, useRef, useEffect } from 'react'
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

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const prevPathname = useRef(pathname)

  // Auto-close on route change — legitimate sync of external navigation state
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing menu state with external navigation
      setIsMenuOpen(false)
    }
  }, [pathname])

  // Auto-close on viewport change to desktop
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setIsMenuOpen(false)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Focus management
  useEffect(() => {
    if (isMenuOpen) {
      firstLinkRef.current?.focus()
    }
  }, [isMenuOpen])

  // Escape key handler
  useEffect(() => {
    if (!isMenuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
        hamburgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isMenuOpen])

  return (
    <>
      <nav className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <PayoLogo size={24} />
          <span className="font-bold text-base sm:text-lg">Payo</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 sm:gap-4">
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
          </div>
          <button
            ref={hamburgerRef}
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
            onClick={() => setIsMenuOpen(prev => !prev)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>
          <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
        </div>
      </nav>
      {isMenuOpen && (
        <div
          id="mobile-menu"
          role="navigation"
          aria-label="Main navigation"
          className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-3"
        >
          <button
            onClick={toggleLang}
            className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-gray-300 self-start"
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </button>
          {links.map((link, index) => {
            const isActive = pathname === link.href
            return (
              <a
                key={link.href}
                ref={index === 0 ? firstLinkRef : undefined}
                href={link.href}
                data-href={link.href}
                className={`text-sm transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t[link.labelKey]}
              </a>
            )
          })}
        </div>
      )}
    </>
  )
}
