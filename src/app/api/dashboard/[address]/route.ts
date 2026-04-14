import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { transferLinks, users } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params

  // Validate Ethereum address format
  if (!ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      { status: 400 },
    )
  }

  // If no database configured, return empty response
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      links: [],
      user: { address, lastSeen: new Date().toISOString() },
    })
  }

  try {
    const db = getDb()

    // Query transfer links for this owner, ordered by created_at DESC
    const links = await db
      .select()
      .from(transferLinks)
      .where(eq(transferLinks.ownerAddress, address))
      .orderBy(desc(transferLinks.createdAt))

    // Upsert user row — insert if new, update last_seen if existing
    const now = new Date()
    const [user] = await db
      .insert(users)
      .values({ address, lastSeen: now })
      .onConflictDoUpdate({
        target: users.address,
        set: { lastSeen: now },
      })
      .returning({ address: users.address, lastSeen: users.lastSeen })

    return NextResponse.json({
      links,
      user: {
        address: user.address,
        lastSeen: user.lastSeen.toISOString(),
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 },
    )
  }
}
