import type { Metadata } from 'next'
import { decodePaymentLink } from '@/lib/encode'
import { generateOgMetadata } from '@/lib/og-metadata'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = decodePaymentLink(id)
  const url = `/pay/${id}`
  return generateOgMetadata({ data, url })
}

export default function PayLayout({ children }: Props) {
  return <>{children}</>
}
