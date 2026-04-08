import { translations } from '@/lib/i18n'

export default function TermsPage() {
  const en = translations.en
  const th = translations.th

  const sections = [
    { enTitle: en.termsNatureTitle, enBody: en.termsNatureBody, thTitle: th.termsNatureTitle, thBody: th.termsNatureBody },
    { enTitle: en.termsProhibitedTitle, enBody: en.termsProhibitedBody, thTitle: th.termsProhibitedTitle, thBody: th.termsProhibitedBody },
    { enTitle: en.termsThirdPartyTitle, enBody: en.termsThirdPartyBody, thTitle: th.termsThirdPartyTitle, thBody: th.termsThirdPartyBody },
    { enTitle: en.termsModificationTitle, enBody: en.termsModificationBody, thTitle: th.termsModificationTitle, thBody: th.termsModificationBody },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-400 text-sm mb-8">ข้อกำหนดการใช้บริการ</p>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <div key={i} className="bg-white/5 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-1">{section.enTitle}</h2>
              <p className="text-sm text-gray-400 mb-3">{section.thTitle}</p>
              <p className="text-sm text-gray-300 leading-relaxed mb-3">{section.enBody}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{section.thBody}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <a href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">
            ← Back to Payo
          </a>
        </div>
      </main>
    </div>
  )
}
