import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { webhookRegistrations } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { signWebhookPayload, sendWebhookRequest } from '@/lib/webhook'
import { buildTestPayload } from '@/lib/webhookPayload'

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export async function POST(
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

  const rows = await getDb()
    .select()
    .from(webhookRegistrations)
    .where(eq(webhookRegistrations.ownerAddress, address))
    .limit(1)

  const registration = rows[0]
  if (!registration) {
    return NextResponse.json(
      { error: 'No webhook registered' },
      { status: 404 },
    )
  }

  const payload = buildTestPayload()
  const rawBody = JSON.stringify(payload)
  const signature = signWebhookPayload(rawBody, registration.webhookSecret)

  const result = await sendWebhookRequest(
    registration.webhookUrl,
    rawBody,
    signature,
    'test',
  )

  return NextResponse.json({
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
  })
}
