'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEMO_PAYMENT_DATA, shortAddress } from '@/lib/encode'
import { DemoBadge } from '@/components/DemoBadge'
import { DemoStepIndicator } from '@/components/DemoStepIndicator'
import { DemoNavbar } from '@/components/DemoNavbar'
import { Jazzicon } from '@/components/Jazzicon'
import { useLang } from '@/context/LangContext'

export default function DemoPayPage() {
  const router = useRouter()
  const { t } = useLang()
  const [loading, setLoading] = useState(false)

  function handleSend() {
    setLoading(true)
    setTimeout(() => {
      router.push('/demo/success')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DemoBadge />
      <DemoNavbar />

      <main className="max-w-sm mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <DemoStepIndicator currentStep={2} />

        <h1 className="text-xl sm:text-2xl font-bold text-center mb-6">{t.demoPayTitle}</h1>

        {/* Payment card */}
        <div className="bg-white/[0.03] ring-1 ring-white/10 rounded-2xl p-5 sm:p-6 mb-6">
          <div className="text-center mb-5">
            <div className="flex items-center justify-center mx-auto mb-3">
              <Jazzicon address={DEMO_PAYMENT_DATA.address} size={56} />
            </div>
            <p className="text-gray-400 text-sm">&ldquo;{DEMO_PAYMENT_DATA.memo}&rdquo;</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t.labelRecipient}</span>
              <span className="font-mono text-gray-200 text-xs sm:text-sm">
                {shortAddress(DEMO_PAYMENT_DATA.address)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelTokenField}</span>
              <span className="font-medium">{DEMO_PAYMENT_DATA.token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelNetwork}</span>
              <span className="text-green-400 text-xs">Chain {DEMO_PAYMENT_DATA.chainId}</span>
            </div>
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-2xl transition-colors text-sm sm:text-base"
        >
          {loading ? t.demoSending : t.demoSendBtn}
        </button>
      </main>
    </div>
  )
}
