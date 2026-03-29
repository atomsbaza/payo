'use client'

import { useState, useCallback } from 'react'
import { UsernameSchema } from '@/lib/validate'
import { useLang } from '@/context/LangContext'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function UsernameSection({ address }: { address: string }) {
  const { t } = useLang()
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [savedUsername, setSavedUsername] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [validationError, setValidationError] = useState('')
  const [copied, setCopied] = useState(false)

  const profileUrl = savedUsername
    ? `${window.location.origin}/u/${savedUsername}`
    : ''

  const validate = useCallback((value: string) => {
    if (!value) {
      setValidationError('')
      return false
    }
    const result = UsernameSchema.safeParse(value)
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Invalid username')
      return false
    }
    setValidationError('')
    return true
  }, [])

  const handleChange = (value: string) => {
    setInput(value)
    setErrorMsg('')
    validate(value)
  }

  const handleSubmit = async () => {
    if (!validate(input)) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch(`/api/username/${address}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: input }),
      })

      if (res.status === 409) {
        setErrorMsg('Username already taken')
        setStatus('error')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg((data as { error?: string }).error ?? 'Something went wrong')
        setStatus('error')
        return
      }

      const data = await res.json() as { username: string }
      setSavedUsername(data.username)
      setStatus('success')
    } catch {
      setErrorMsg('Network error, please try again')
      setStatus('error')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isValid = input.length > 0 && !validationError

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
      <label className="text-sm font-medium text-gray-300 mb-3 block">
        {t.profileUsername}
      </label>

      {/* Success state — show profile URL */}
      {status === 'success' && savedUsername ? (
        <div className="space-y-2">
          <p className="text-sm text-green-400">
            ✓ @{savedUsername}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-indigo-400 truncate">
              {profileUrl}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 text-xs px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => {
              setStatus('idle')
              setInput(savedUsername)
            }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Change username
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => handleChange(e.target.value.toLowerCase())}
              placeholder="e.g. alice"
              className="flex-1 text-sm bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              disabled={status === 'loading'}
            />
            <button
              onClick={handleSubmit}
              disabled={!isValid || status === 'loading'}
              className="shrink-0 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {status === 'loading' ? '...' : 'Set'}
            </button>
          </div>

          {/* Client-side validation feedback */}
          {validationError && (
            <p className="text-xs text-red-400">{validationError}</p>
          )}

          {/* API error */}
          {errorMsg && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  )
}
