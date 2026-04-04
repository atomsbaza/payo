'use client'

import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Jazzicon } from '@/components/Jazzicon'
import { useLang } from '@/context/LangContext'

type PublicLink = {
  linkId: string
  token: string
  amount: string | null
  memo: string | null
  chainId: number
  expiresAt: string | null
}

type ProfileClientProps = {
  username: string
  address: string
  shortAddress: string
  ensName: string | null
  links: PublicLink[]
}

export function ProfileClient({
  username,
  address,
  shortAddress,
  ensName,
  links,
}: ProfileClientProps) {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      <main className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Profile header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <Jazzicon address={address} size={72} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{username}</h1>
          <div className="mt-2 flex flex-col items-center gap-1">
            <span className="font-mono text-sm text-gray-400">
              {shortAddress}
            </span>
            {ensName && (
              <span className="text-sm text-indigo-400">{ensName}</span>
            )}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            {t.profileActiveLinks(links.length)}
          </p>
        </div>

        {/* Payment links list */}
        {links.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-gray-400">{t.profileNoLinks}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.linkId}
                className="bg-white/[0.03] ring-1 ring-white/10 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{link.token}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-300">
                      {link.amount ?? t.profileAnyAmount}
                    </span>
                  </div>
                  {link.memo && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      &ldquo;{link.memo}&rdquo;
                    </p>
                  )}
                </div>
                <Link
                  href={`/pay/${link.linkId}`}
                  className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {t.profilePayButton}
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
