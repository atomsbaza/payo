'use client'

import { useLang } from '@/context/LangContext'

export function Footer() {
  const { t } = useLang()

  return (
    <footer className="border-t border-white/10 px-4 sm:px-6 py-6 text-center text-sm text-gray-500">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a href="/terms" className="hover:text-gray-300 transition-colors">{t.footerTerms}</a>
        <a href="/privacy" className="hover:text-gray-300 transition-colors">{t.footerPrivacy}</a>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
        <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Discord</a>
      </div>
    </footer>
  )
}
