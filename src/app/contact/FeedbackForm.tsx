'use client'

import { useState } from 'react'

type FormState = { name: string; email: string; category: string; message: string }
type ErrorState = Partial<Record<keyof FormState, string>>
type SubmitState = 'idle' | 'submitting' | 'success' | 'error' | 'rate-limited' | 'network-error'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CATEGORIES = ['Bug Report', 'Feature Request', 'General Feedback', 'Other'] as const

const MESSAGE_MAX = 2000

export default function FeedbackForm() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    category: '',
    message: '',
  })
  const [errors, setErrors] = useState<ErrorState>({})
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // --- per-field blur validation ---
  function validateField(field: keyof FormState, value: string): string | undefined {
    if (field === 'name') {
      if (!value.trim()) return 'This field is required'
    }
    if (field === 'email') {
      if (!value.trim()) return 'This field is required'
      if (!EMAIL_RE.test(value.trim())) return 'Please enter a valid email address'
    }
    if (field === 'category') {
      if (!value) return 'This field is required'
    }
    if (field === 'message') {
      if (!value.trim()) return 'This field is required'
      if (value.trim().length < 10) return 'Message must be at least 10 characters'
    }
    return undefined
  }

  function handleBlur(field: keyof FormState) {
    const error = validateField(field, form[field])
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear error on change so it re-validates on next blur
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // --- submit ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate all fields before submitting
    const newErrors: ErrorState = {}
    for (const field of ['name', 'email', 'category', 'message'] as const) {
      const error = validateField(field, form[field])
      if (error) newErrors[field] = error
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitState('submitting')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.status === 201) {
        setSubmitState('success')
      } else if (res.status === 429) {
        setSubmitState('rate-limited')
      } else {
        setSubmitState('error')
      }
    } catch {
      setSubmitState('network-error')
    }
  }

  // --- success state ---
  if (submitState === 'success') {
    return (
      <div className="rounded-2xl bg-gray-800/60 border border-white/10 p-8 text-center">
        <p className="text-lg font-semibold text-green-400">
          Thank you! Your feedback has been received.
        </p>
      </div>
    )
  }

  const charsRemaining = MESSAGE_MAX - form.message.length

  const errorBanner =
    submitState === 'rate-limited'
      ? "You've sent too many messages. Please try again later."
      : submitState === 'error'
      ? 'Something went wrong. Please try again.'
      : submitState === 'network-error'
      ? 'Network error. Please check your connection and try again.'
      : null

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {errorBanner && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {errorBanner}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="fb-name" className="block text-sm font-medium text-gray-300 mb-1.5">
          Name
        </label>
        <input
          id="fb-name"
          type="text"
          required
          maxLength={100}
          value={form.name}
          onChange={e => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          placeholder="Your name"
        />
        {errors.name && (
          <p className="mt-1.5 text-sm text-red-400">{errors.name}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="fb-email" className="block text-sm font-medium text-gray-300 mb-1.5">
          Email
        </label>
        <input
          id="fb-email"
          type="email"
          required
          maxLength={254}
          value={form.email}
          onChange={e => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          placeholder="you@example.com"
        />
        {errors.email && (
          <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="fb-category" className="block text-sm font-medium text-gray-300 mb-1.5">
          Category
        </label>
        <select
          id="fb-category"
          required
          value={form.category}
          onChange={e => handleChange('category', e.target.value)}
          onBlur={() => handleBlur('category')}
          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors appearance-none"
        >
          <option value="" disabled className="text-gray-500">Select a category</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat} className="bg-gray-800 text-white">{cat}</option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1.5 text-sm text-red-400">{errors.category}</p>
        )}
      </div>

      {/* Message */}
      <div>
        <label htmlFor="fb-message" className="block text-sm font-medium text-gray-300 mb-1.5">
          Message
        </label>
        <textarea
          id="fb-message"
          required
          maxLength={MESSAGE_MAX}
          rows={5}
          value={form.message}
          onChange={e => handleChange('message', e.target.value)}
          onBlur={() => handleBlur('message')}
          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
          placeholder="Tell us what's on your mind..."
        />
        <div className="flex items-start justify-between mt-1.5">
          {errors.message ? (
            <p className="text-sm text-red-400">{errors.message}</p>
          ) : (
            <span />
          )}
          <p className="text-sm text-gray-400 ml-auto">
            {charsRemaining} characters remaining
          </p>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitState === 'submitting'}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {submitState === 'submitting' && (
          <span
            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            aria-hidden="true"
          />
        )}
        Send Feedback
      </button>
    </form>
  )
}
