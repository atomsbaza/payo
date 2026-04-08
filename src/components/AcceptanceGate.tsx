'use client'

import { useLang } from '@/context/LangContext'

interface AcceptanceGateProps {
  accepted: boolean
  onChange: (accepted: boolean) => void
}

export function AcceptanceGate({ accepted, onChange }: AcceptanceGateProps) {
  const { t } = useLang()

  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
      />
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors leading-relaxed">
        {t.disclaimerAcceptLabel}
      </span>
    </label>
  )
}
