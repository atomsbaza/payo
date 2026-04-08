'use client'

import { useLang } from '@/context/LangContext'

export function NonCustodialBadge() {
  const { t } = useLang()

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
      🛡 {t.nonCustodialBadge}
    </span>
  )
}
