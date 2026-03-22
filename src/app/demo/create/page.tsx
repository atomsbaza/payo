'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DEMO_PAYMENT_DATA, encodePaymentLink, shortAddress } from '@/lib/encode'
import { DemoBadge } from '@/components/DemoBadge'
import { DemoStepIndicator } from '@/components/DemoStepIndicator'
import { DemoNavbar } from '@/components/DemoNavbar'
import { QRDisplay } from '@/components/QRDisplay'
import { useLang } from '@/context/LangContext'

export default function DemoCreatePage() {
  const router = useRouter()
  const { t } = useLang()

  const qrUrl = useMemo(() => {
    const encoded = encodePaymentLink(DEMO_PAYMENT_DATA)
    return typeof window !== 'undefined'
      ? `${window.location.origin}/pay/${encoded}`
      : `/pay/${encoded}`
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DemoBadge />
      <DemoNavbar />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <DemoStepIndicator currentStep={1} />

        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t.demoCreateTitle}</h1>
          <p className="text-sm sm:text-base text-gray-400">{t.demoCreateDesc}</p>
        </div>

        {/* Read-only display of DEMO_PAYMENT_DATA */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-400">{t.labelRecipient}</span>
            <span className="text-sm font-medium">{shortAddress(DEMO_PAYMENT_DATA.address)}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-400">{t.labelTokenField}</span>
            <span className="text-sm font-medium">{DEMO_PAYMENT_DATA.token}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-400">{t.labelAmount}</span>
            <span className="text-sm font-medium">{DEMO_PAYMENT_DATA.amount} {DEMO_PAYMENT_DATA.token}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-400">{t.labelMemo}</span>
            <span className="text-sm font-medium">{DEMO_PAYMENT_DATA.memo}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-400">{t.labelNetwork}</span>
            <span className="text-sm font-medium">Chain {DEMO_PAYMENT_DATA.chainId}</span>
          </div>
        </div>

        {/* QR Code */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-[1px]">
          <div className="p-5 sm:p-6 bg-gray-950 rounded-2xl">
            <QRDisplay url={qrUrl} />
          </div>
        </div>

        {/* Create button — navigates to /demo/pay, NO API calls */}
        <button
          onClick={() => router.push('/demo/pay')}
          className="mt-6 w-full py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          {t.demoCreateBtn}
        </button>
      </main>
    </div>
  )
}
