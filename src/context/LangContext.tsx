'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { translations, Lang, Translations } from '@/lib/i18n'

type LangContextType = {
  lang: Lang
  t: Translations
  toggleLang: () => void
}

const LangContext = createContext<LangContextType>({
  lang: 'th',
  t: translations.th,
  toggleLang: () => {},
})

function getInitialLang(): Lang {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lang') as Lang | null
    if (saved === 'th' || saved === 'en') return saved
  }
  return 'th'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang)

  const toggleLang = () => {
    setLang(prev => {
      const next: Lang = prev === 'th' ? 'en' : 'th'
      localStorage.setItem('lang', next)
      return next
    })
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
