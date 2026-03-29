import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { users } from '@/lib/schema'
import { ETH_ADDRESS_RE, UsernameSchema } from '@/lib/validate'
import { createRateLimiter } from '@/lib/rate-limit'

const limiter = createRateLimiter(5, 60_000)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params

  if (!ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      { status: 400 },
    )
  }

  const { allowed, retryAfter } = limiter.check(address.toLowerCase())
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = UsernameSchema.safeParse(
    (body as Record<string, unknown>)?.username,
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid username' },
      { status: 400 },
    )
  }
  const username = parsed.data

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 },
    )
  }

  try {
    const db = getDb()
    const now = new Date()

    const [user] = await db
      .insert(users)
      .values({ address, username, lastSeen: now })
      .onConflictDoUpdate({
        target: users.address,
        set: { username, lastSeen: now },
      })
      .returning({
        address: users.address,
        username: users.username,
        lastSeen: users.lastSeen,
      })

    return NextResponse.json({
      address: user.address,
      username: user.username,
      lastSeen: user.lastSeen.toISOString(),
    })
  } catch (error: unknown) {
    const dbError = error as { code?: string }
    if (dbError.code === '23505') {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 },
      )
    }
    console.error('Username API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
