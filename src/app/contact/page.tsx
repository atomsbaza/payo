import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import FeedbackForm from './FeedbackForm'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Get in Touch</h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Have a question, found a bug, or want to share an idea? We&apos;d love to hear from you.
            Fill out the form below and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
          <FeedbackForm />
        </div>
      </main>

      <Footer />
    </div>
  )
}
