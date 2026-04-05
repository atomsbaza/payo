// POST /api/push/subscribe — save a Web Push subscription for an owner address
// DELETE /api/push/subscribe — remove a subscription (on unsubscribe)
import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { pushSubscriptions } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const SubscribeSchema = z.object({
  address:  z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  endpoint: z.string().url('Invalid endpoint URL'),
  p256dh:   z.string().min(1),
  auth:     z.string().min(1),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { address, endpoint, p256dh, auth } = parsed.data

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: true })
  }

  try {
    await getDb()
      .insert(pushSubscriptions)
      .values({ ownerAddress: address, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: [pushSubscriptions.ownerAddress, pushSubscriptions.endpoint],
        set: { p256dh, auth, updatedAt: new Date() },
      })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe] POST error:', err)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { address, endpoint } = parsed.data

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: true })
  }

  try {
    await getDb()
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.ownerAddress, address),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
