'use client'

import { useLang } from '@/context/LangContext'

export function DemoBadge() {
  const { t } = useLang()
  return (
    <div className="w-full bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-400">
      {t.demoBanner}
    </div>
  )
}
