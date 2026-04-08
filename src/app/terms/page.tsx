import { translations } from '@/lib/i18n'

export default function TermsPage() {
  const en = translations.en

  const sections = [
    { title: en.termsNatureTitle, body: en.termsNatureBody },
    { title: en.termsProhibitedTitle, body: en.termsProhibitedBody },
    { title: en.termsThirdPartyTitle, body: en.termsThirdPartyBody },
    { title: en.termsModificationTitle, body: en.termsModificationBody },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">Terms of Service</h1>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="bg-white/5 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-3">{section.title}</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{section.body}</p>
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
