'use client'

import { useLang } from '@/context/LangContext'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'

const STEPS = [
  { titleKey: 'step1Title', descKey: 'step1Desc', icon: '🔗' },
  { titleKey: 'step2Title', descKey: 'step2Desc', icon: '📤' },
  { titleKey: 'step3Title', descKey: 'step3Desc', icon: '💰' },
] as const

const VALUE_PROPS = [
  { key: 'valueProp1', icon: '🔒' },
  { key: 'valueProp2', icon: '⚡' },
  { key: 'valueProp3', icon: '🌐' },
] as const

export default function LandingPage() {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 text-center max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4">{t.heroTitle}</h1>
        <p className="text-base sm:text-lg text-gray-400 mb-8 max-w-xl mx-auto">{t.heroSubtitle}</p>
        <Link
          href="/create"
          className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-colors"
        >
          {t.heroCta}
        </Link>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">{t.howItWorksTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div key={i} className="bg-white/5 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">{step.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{t[step.titleKey]}</h3>
              <p className="text-sm text-gray-400">{t[step.descKey]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Value Propositions */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">{t.valuePropsTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {VALUE_PROPS.map((vp, i) => (
            <div key={i} className="bg-white/5 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">{vp.icon}</div>
              <p className="text-sm text-gray-300">{t[vp.key]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
