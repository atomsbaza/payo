'use client'

import Link from 'next/link'
import { useLang } from '@/context/LangContext'
import { OpenSourceBadge } from '@/components/OpenSourceBadge'

const GITHUB_REPO_URL = 'https://github.com/atomsbaza/payo'

export function Footer() {
  const { t } = useLang()

  return (
    <footer className="border-t border-white/10 px-4 sm:px-6 py-6 text-center text-sm text-gray-500">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/terms" className="hover:text-gray-300 transition-colors">
          {t.footerTerms}
        </Link>
        <OpenSourceBadge repoUrl={GITHUB_REPO_URL} />
      </div>
    </footer>
  )
}
