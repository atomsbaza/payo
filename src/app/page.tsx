'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/context/LangContext'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
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
  const [linkCount, setLinkCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/links')
      .then(res => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json()
      })
      .then(data => {
        if (typeof data.count === 'number') setLinkCount(data.count)
      })
      .catch(() => {
        // Graceful fallback — hide counter on error
        setLinkCount(null)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 text-center max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4">{t.heroTitle}</h1>
        <p className="text-base sm:text-lg text-gray-400 mb-8 max-w-xl mx-auto">{t.heroSubtitle}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/create"
            className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-colors"
          >
            {t.heroCta}
          </Link>
          <Link
            href="/pay/demo"
            className="inline-block px-6 py-3 border border-white/20 text-gray-300 hover:bg-white/10 rounded-xl font-semibold transition-colors"
          >
            {t.demoBtn}
          </Link>
        </div>

        {/* Social Proof Counter */}
        {linkCount !== null && (
          <p className="mt-4 text-sm text-gray-400" data-testid="social-proof-counter">
            {t.socialProof(linkCount)}
          </p>
        )}

        {/* Product Screenshot — Device Mockup */}
        <div className="mt-12 sm:mt-16 flex justify-center" data-testid="hero-device-mockup">
          <div className="relative w-[260px] sm:w-[300px] md:w-[320px]">
            {/* Phone frame */}
            <div className="rounded-[2.5rem] border-[3px] border-white/10 bg-gray-950 p-3 shadow-2xl shadow-indigo-500/10">
              {/* Notch */}
              <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-gray-900" />
              {/* Screen */}
              <div className="rounded-[1.75rem] bg-gray-900 px-4 py-5 space-y-4">
                {/* Mini navbar */}
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600" />
                  <span className="text-xs font-semibold text-white/80">Payo</span>
                </div>
                {/* Mock payment card */}
                <div className="rounded-2xl ring-1 ring-white/10 bg-white/[0.03] p-4 space-y-3">
                  {/* Avatar + amount */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 via-indigo-400 to-violet-500" />
                    <span className="text-sm font-bold text-white">0.05 ETH</span>
                    <span className="text-[10px] text-gray-500">≈ $125.00</span>
                  </div>
                  {/* Details rows */}
                  <div className="space-y-2 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">To</span>
                      <span className="font-mono text-gray-300">0x1a2b…9f3e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Network</span>
                      <span className="text-green-400">Base</span>
                    </div>
                  </div>
                  {/* Mock pay button */}
                  <div className="rounded-xl bg-indigo-600 py-2 text-center text-xs font-semibold text-white">
                    Pay 0.05 ETH
                  </div>
                </div>
                {/* Secured badge */}
                <p className="text-[9px] text-gray-500 text-center">🔒 Secured by Base</p>
              </div>
            </div>
            {/* Glow effect behind phone */}
            <div className="absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-2xl" />
          </div>
        </div>
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

      <Footer />
    </div>
  )
}
