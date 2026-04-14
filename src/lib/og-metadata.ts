import type { Metadata } from 'next'
import type { TransferLinkData } from './encode'
import { shortAddress } from './encode'

const SITE_NAME = 'Crypto Pay Link'
const DEFAULT_OG_IMAGE = '/og-image.png'

export type OgInput = {
  data: TransferLinkData | null
  url: string
}

/**
 * Pure function that generates OpenGraph metadata from payment link data.
 * Exported separately so it can be unit/property tested without Next.js runtime.
 */
export function generateOgMetadata({ data, url }: OgInput): Metadata {
  // Fallback when decode fails
  if (!data) {
    return {
      title: SITE_NAME,
      description: 'PromptPay สำหรับ Crypto — สร้าง payment link แล้วแชร์ได้เลย',
      openGraph: {
        title: SITE_NAME,
        description: 'PromptPay สำหรับ Crypto — สร้าง payment link แล้วแชร์ได้เลย',
        url,
        images: [DEFAULT_OG_IMAGE],
      },
      twitter: {
        card: 'summary_large_image',
      },
    }
  }

  const ogTitle = data.amount
    ? `Pay ${data.amount} ${data.token} — ${SITE_NAME}`
    : `Pay ${data.token} — ${SITE_NAME}`

  const descParts: string[] = []
  if (data.memo) descParts.push(data.memo)
  descParts.push(`To ${shortAddress(data.address)}`)
  const ogDescription = descParts.join(' · ')

  return {
    title: ogTitle,
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
    },
  }
}
