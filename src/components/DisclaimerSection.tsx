'use client'

import Link from 'next/link'
import { useLang } from '@/context/LangContext'

export function DisclaimerSection() {
  const { t } = useLang()

  const sections = [
    { title: t.disclaimerSection1Title, body: t.disclaimerSection1Body },
    { title: t.disclaimerSection2Title, body: t.disclaimerSection2Body },
    { title: t.disclaimerSection3Title, body: t.disclaimerSection3Body },
    { title: t.disclaimerSection4Title, body: t.disclaimerSection4Body },
  ]

  return (
    <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-5 text-sm">
      <h2 className="font-bold text-amber-400 mb-4 text-base">{t.disclaimerTitle}</h2>
      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={i}>
            <h3 className="font-semibold text-white mb-1">{section.title}</h3>
            <p className="text-gray-400 leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-amber-500/20">
        <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 text-xs underline">
          Read full Terms of Service →
        </Link>
      </div>
    </div>
  )
}
