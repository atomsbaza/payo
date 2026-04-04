import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { pushTokens } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DEVICE_TOKEN_RE = /^[a-fA-F0-9]{64}$/  // 32 bytes hex = 64 chars

const Schema = z.object({
  address:     z.string().regex(ETH_ADDRESS_RE, 'Invalid Ethereum address'),
  deviceToken: z.string().regex(DEVICE_TOKEN_RE, 'Invalid APNs device token'),
  platform:    z.enum(['ios']).default('ios'),
})

// POST /api/notifications/register
// Body: { address: "0x...", deviceToken: "64hexchars", platform: "ios" }
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { address, deviceToken, platform } = parsed.data

  if (!isDatabaseConfigured()) {
    // Acknowledge without persisting — push will be no-op
    return NextResponse.json({ success: true })
  }

  try {
    const db = getDb()

    // Upsert: one row per (address, deviceToken) pair
    const existing = await db
      .select({ id: pushTokens.id })
      .from(pushTokens)
      .where(
        and(
          eq(pushTokens.ownerAddress, address),
          eq(pushTokens.deviceToken, deviceToken),
        ),
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(pushTokens).values({ ownerAddress: address, deviceToken, platform })
    } else {
      await db
        .update(pushTokens)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(pushTokens.ownerAddress, address),
            eq(pushTokens.deviceToken, deviceToken),
          ),
        )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('POST /api/notifications/register error:', error)
    return NextResponse.json({ error: 'Failed to register device token' }, { status: 500 })
  }
}

// DELETE /api/notifications/register
// Body: { address: "0x...", deviceToken: "64hexchars" }
// Called on app logout or when APNs returns an invalid token error
export async function DELETE(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { address, deviceToken } = parsed.data

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: true })
  }

  try {
    await getDb()
      .delete(pushTokens)
      .where(
        and(
          eq(pushTokens.ownerAddress, address),
          eq(pushTokens.deviceToken, deviceToken),
        ),
      )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/notifications/register error:', error)
    return NextResponse.json({ error: 'Failed to remove device token' }, { status: 500 })
  }
}
