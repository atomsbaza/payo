import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { users, transferLinks } from '@/lib/schema'
import { UsernameSchema } from '@/lib/validate'
import { createRateLimiter } from '@/lib/rate-limit'
import { eq, and, or, isNull, gt } from 'drizzle-orm'

const limiter = createRateLimiter(30, 60_000)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Validate slug format
  const parsed = UsernameSchema.safeParse(slug)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid username format' },
      { status: 400 },
    )
  }

  // Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { allowed, retryAfter } = limiter.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }

  try {
    const db = getDb()

    // Find user by username
    const [user] = await db
      .select({
        address: users.address,
        username: users.username,
        ensName: users.ensName,
      })
      .from(users)
      .where(eq(users.username, slug))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 },
      )
    }

    // Query active, non-expired payment links
    const now = new Date()
    const links = await db
      .select({
        linkId: transferLinks.linkId,
        token: transferLinks.token,
        amount: transferLinks.amount,
        memo: transferLinks.memo,
        chainId: transferLinks.chainId,
        expiresAt: transferLinks.expiresAt,
      })
      .from(transferLinks)
      .where(
        and(
          eq(transferLinks.ownerAddress, user.address),
          eq(transferLinks.isActive, true),
          or(
            isNull(transferLinks.expiresAt),
            gt(transferLinks.expiresAt, now),
          ),
        ),
      )

    const shortAddress =
      user.address.slice(0, 6) + '...' + user.address.slice(-4)

    return NextResponse.json({
      username: user.username,
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
    })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
