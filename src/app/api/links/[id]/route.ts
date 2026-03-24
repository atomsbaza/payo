import { NextRequest, NextResponse } from 'next/server'
import { decodePaymentLink, isDemoLink, DEMO_PAYMENT_DATA } from '@/lib/encode'
import { validatePaymentLink } from '@/lib/validate'
import { verifyPaymentLink } from '@/lib/hmac'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { paymentLinks } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { logLinkEvent } from '@/lib/link-events'

// GET /api/links/[id] — decode and verify a payment link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Extract IP and user agent for event logging
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
  const userAgent = request.headers.get('user-agent') || undefined

  // 1. Demo link — return demo data without querying DB
  if (isDemoLink(id)) {
    return NextResponse.json({ id, data: DEMO_PAYMENT_DATA, verified: true, tampered: false })
  }

  // 2. If DB is configured, try to look up the link there first
  if (isDatabaseConfigured()) {
    try {
      const db = getDb()
      const rows = await db
        .select()
        .from(paymentLinks)
        .where(eq(paymentLinks.linkId, id))
        .limit(1)

      if (rows.length > 0) {
        const row = rows[0]

        // Increment view_count atomically
        await db
          .update(paymentLinks)
          .set({ viewCount: sql`${paymentLinks.viewCount} + 1` })
          .where(eq(paymentLinks.linkId, id))

        // Fire-and-forget: log 'viewed' event
        logLinkEvent({
          linkId: id,
          eventType: 'viewed',
          ipHash: ip,
          userAgent,
        }).catch(() => {})

        // Reconstruct PaymentLinkData from DB row
        // expiresAt is stored as Date in DB; return as ISO string for the API response
        const data = {
          address: row.recipient,
          token: row.token,
          amount: row.amount || '',
          memo: row.memo || '',
          chainId: row.chainId,
          signature: row.signature,
          expiresAt: row.expiresAt?.toISOString(),
        }

        return NextResponse.json({ id, data, verified: true, tampered: false })
      }
      // Not found in DB — fall through to HMAC decode
    } catch {
      // DB query failed — fall through to HMAC decode
    }
  }

  // 3. HMAC decode fallback (existing logic)
  const data = decodePaymentLink(id)

  if (!data) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  // Validate payment link data
  const validation = validatePaymentLink(data)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  // Verify HMAC signature
  const hmacValid = verifyPaymentLink(data)

  // Fire-and-forget: log 'viewed' event for fallback path
  logLinkEvent({
    linkId: id,
    eventType: 'viewed',
    ipHash: ip,
    userAgent,
  }).catch(() => {})

  // Fire-and-forget: log 'tamper_blocked' when HMAC verification fails
  if (!hmacValid) {
    logLinkEvent({
      linkId: id,
      eventType: 'tamper_blocked',
      ipHash: ip,
      userAgent,
    }).catch(() => {})
  }

  return NextResponse.json({ id, data, verified: hmacValid, tampered: !hmacValid })
}
