'use client'

import { createContext, useContext, ReactNode } from 'react'
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
  const lang: Lang = 'en'

  const toggleLang = () => {
    // Language toggle disabled — English only
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
