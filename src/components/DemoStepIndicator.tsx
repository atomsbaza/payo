'use client'

import { DEMO_STEPS } from '@/lib/demo'
import { useLang } from '@/context/LangContext'

type DemoStepIndicatorProps = {
  currentStep: 1 | 2 | 3
}

export function DemoStepIndicator({ currentStep }: DemoStepIndicatorProps) {
  const { lang } = useLang()

  return (
    <div className="flex items-center justify-center gap-0 py-4">
      {DEMO_STEPS.map((s, i) => {
        const isCompleted = s.step < currentStep
        const isCurrent = s.step === currentStep
        const label = lang === 'th' ? s.labelTh : s.labelEn

        return (
          <div key={s.step} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isCurrent
                    ? 'bg-indigo-600 text-white'
                    : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {isCompleted ? '✓' : s.step}
              </div>
              <span
                className={`mt-1 text-xs ${
                  isCurrent
                    ? 'text-indigo-400 font-medium'
                    : isCompleted
                      ? 'text-green-400'
                      : 'text-zinc-500'
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {i < DEMO_STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-10 ${
                  s.step < currentStep ? 'bg-green-600' : 'bg-zinc-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
