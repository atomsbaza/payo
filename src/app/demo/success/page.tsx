'use client'

import Link from 'next/link'
import { DEMO_PAYMENT_DATA, shortAddress } from '@/lib/encode'
import { DEMO_TX_HASH } from '@/lib/demo'
import { DemoBadge } from '@/components/DemoBadge'
import { DemoStepIndicator } from '@/components/DemoStepIndicator'
import { DemoNavbar } from '@/components/DemoNavbar'
import { useLang } from '@/context/LangContext'

export default function DemoSuccessPage() {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DemoBadge />
      <DemoNavbar />

      <main className="max-w-sm mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <DemoStepIndicator currentStep={3} />

        {/* Success animation */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-xl sm:text-2xl font-bold">{t.demoSuccessTitle}</h1>
          <p className="text-gray-400 text-sm mt-2">{t.demoSuccessDesc}</p>
        </div>

        {/* Payment summary */}
        <div className="bg-white/[0.03] ring-1 ring-white/10 rounded-2xl p-5 sm:p-6 mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelAmount}</span>
              <span className="font-medium">
                {DEMO_PAYMENT_DATA.amount} {DEMO_PAYMENT_DATA.token}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t.labelRecipient}</span>
              <span className="font-mono text-gray-200 text-xs sm:text-sm">
                {shortAddress(DEMO_PAYMENT_DATA.address)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t.demoTxHash}</span>
              <span className="font-mono text-gray-200 text-xs">
                {shortAddress(DEMO_TX_HASH)}
              </span>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="space-y-3">
          <Link
            href="/create"
            className="block w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-colors text-center text-sm sm:text-base"
          >
            {t.demoTryReal}
          </Link>
          <Link
            href="/"
            className="block w-full py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl transition-colors text-center text-sm sm:text-base"
          >
            {t.demoGoHome}
          </Link>
        </div>
      </main>
    </div>
  )
}
