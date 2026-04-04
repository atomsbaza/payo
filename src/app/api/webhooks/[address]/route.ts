import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { webhookRegistrations, webhookLogs } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { generateWebhookSecret } from '@/lib/webhook'
import { z } from 'zod'

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const WebhookRegistrationSchema = z.object({
  url: z.url().refine(
    (u) => u.startsWith('https://'),
    { message: 'Webhook URL must use HTTPS' },
  ),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params

  if (!ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      { status: 400 },
    )
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ url: null, recentLogs: [] })
  }

  try {
    const db = getDb()
    const rows = await db
      .select()
      .from(webhookRegistrations)
      .where(eq(webhookRegistrations.ownerAddress, address))
      .limit(1)

    const logs = await db.select({
      eventType: webhookLogs.eventType,
      httpStatus: webhookLogs.httpStatus,
      responseTimeMs: webhookLogs.responseTimeMs,
      success: webhookLogs.success,
      errorMessage: webhookLogs.errorMessage,
      createdAt: webhookLogs.createdAt,
    }).from(webhookLogs)
      .where(eq(webhookLogs.ownerAddress, address))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(20)

    const registration = rows[0]
    if (!registration) {
      return NextResponse.json({ url: null, recentLogs: logs })
    }

    return NextResponse.json({
      url: registration.webhookUrl,
      createdAt: registration.createdAt,
      lastTriggeredAt: registration.lastTriggeredAt,
      recentLogs: logs,
    })
  } catch (error) {
    console.error('Webhook GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhook configuration' },
      { status: 500 },
    )
  }
}


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params

  if (!ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = WebhookRegistrationSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json(
      { error: message },
      { status: 400 },
    )
  }

  const { url } = parsed.data

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    const db = getDb()

    // Check if registration already exists
    const existing = await db
      .select()
      .from(webhookRegistrations)
      .where(eq(webhookRegistrations.ownerAddress, address))
      .limit(1)

    if (existing.length === 0) {
      // New registration — generate secret
      const secret = generateWebhookSecret()
      await db.insert(webhookRegistrations).values({
        ownerAddress: address,
        webhookUrl: url,
        webhookSecret: secret,
      })
      return NextResponse.json(
        { success: true, secret },
        { status: 201 },
      )
    }

    // Update existing — only URL and updatedAt, don't regenerate secret
    await db
      .update(webhookRegistrations)
      .set({ webhookUrl: url, updatedAt: new Date() })
      .where(eq(webhookRegistrations.ownerAddress, address))

    return NextResponse.json({ success: true, updated: true })
  } catch (error) {
    console.error('Webhook POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save webhook configuration' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params

  if (!ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Invalid Ethereum address' },
      { status: 400 },
    )
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    const db = getDb()
    await db
      .delete(webhookRegistrations)
      .where(eq(webhookRegistrations.ownerAddress, address))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete webhook configuration' },
      { status: 500 },
    )
  }
}
