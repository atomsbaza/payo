'use client'

import { useLang } from '@/context/LangContext'

export function Footer() {
  const { t } = useLang()

  return (
    <footer className="border-t border-white/10 px-4 sm:px-6 py-6 text-center text-sm text-gray-500">
      <div className="flex flex-wrap items-center justify-center gap-4">
      </div>
    </footer>
  )
}
