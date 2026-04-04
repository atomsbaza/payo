import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { users, paymentLinks } from '@/lib/schema'
import { UsernameSchema } from '@/lib/validate'
import { eq, and, or, isNull, gt } from 'drizzle-orm'
import { ProfileClient } from './ProfileClient'

type Props = {
  params: Promise<{ slug: string }>
}

/** Fetch profile data directly from DB (shared by generateMetadata and page) */
async function getProfile(slug: string) {
  const parsed = UsernameSchema.safeParse(slug)
  if (!parsed.success) return null
  if (!isDatabaseConfigured()) return null

  const db = getDb()

  const [user] = await db
    .select({
      address: users.address,
      username: users.username,
      ensName: users.ensName,
    })
    .from(users)
    .where(eq(users.username, slug))
    .limit(1)

  if (!user) return null

  const now = new Date()
  const links = await db
    .select({
      linkId: paymentLinks.linkId,
      token: paymentLinks.token,
      amount: paymentLinks.amount,
      memo: paymentLinks.memo,
      chainId: paymentLinks.chainId,
      expiresAt: paymentLinks.expiresAt,
    })
    .from(paymentLinks)
    .where(
      and(
        eq(paymentLinks.ownerAddress, user.address),
        eq(paymentLinks.isActive, true),
        or(isNull(paymentLinks.expiresAt), gt(paymentLinks.expiresAt, now)),
      ),
    )

  const shortAddress =
    user.address.slice(0, 6) + '...' + user.address.slice(-4)

  return {
    username: user.username!,
    address: user.address,
    shortAddress,
    ensName: user.ensName ?? null,
    links: links.map((l) => ({
      linkId: l.linkId,
      token: l.token,
      amount: l.amount ?? null,
      memo: l.memo ?? null,
      chainId: l.chainId,
      expiresAt: l.expiresAt?.toISOString() ?? null,
    })),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const profile = await getProfile(slug)

  if (!profile) {
    return { title: 'Profile not found — Payo' }
  }

  const linkCount = profile.links.length
  const description = `${linkCount} active payment link${linkCount !== 1 ? 's' : ''}`
  const title = `${profile.username} — Payo`
  const canonicalUrl = `/u/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ['/og-payo.svg'],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params
  const profile = await getProfile(slug)

  if (!profile) {
    notFound()
  }

  return (
    <ProfileClient
      username={profile.username}
      address={profile.address}
      shortAddress={profile.shortAddress}
      ensName={profile.ensName}
      links={profile.links}
    />
  )
}
