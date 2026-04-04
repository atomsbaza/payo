'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Lang, Translations } from '@/lib/i18n'

type LangContextType = {
  lang: Lang
  t: Translations
  toggleLang: () => void
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  t: translations.en,
  toggleLang: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  // Sync from localStorage after hydration to avoid mismatch
  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang | null
    if (saved === 'th' || saved === 'en') setLang(saved)
  }, [])

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
