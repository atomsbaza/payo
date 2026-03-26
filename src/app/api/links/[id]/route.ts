import { NextRequest, NextResponse } from 'next/server'
import { decodePaymentLink, isDemoLink, DEMO_PAYMENT_DATA } from '@/lib/encode'
import { validatePaymentLink } from '@/lib/validate'
import { verifyPaymentLink } from '@/lib/hmac'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { paymentLinks, linkEvents } from '@/lib/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logLinkEvent } from '@/lib/link-events'
import { upsertTransactions } from '@/lib/tx-cache'
import { createRateLimiter } from '@/lib/rate-limit'

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const postLimiter = createRateLimiter(5, 60_000)

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
    return NextResponse.json({
      id,
      data: DEMO_PAYMENT_DATA,
      verified: true,
      tampered: false,
      isActive: true,
      deactivatedAt: null,
      singleUse: false,
    })
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

        return NextResponse.json({
          id,
          data,
          verified: true,
          tampered: false,
          isActive: row.isActive,
          deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
          singleUse: row.singleUse ?? false,
        })
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

  return NextResponse.json({
    id,
    data,
    verified: hmacValid,
    tampered: !hmacValid,
    isActive: true,
    deactivatedAt: null,
    singleUse: false,
  })
}


// POST /api/links/[id] — payment confirmation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Graceful degradation: no DB → acknowledge without persisting
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: true })
  }

  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { allowed, retryAfter } = postLimiter.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // Parse body
  let body: { txHash?: string; payerAddress?: string; amount?: string; token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { txHash, payerAddress, amount, token } = body

  // Validate required fields
  if (!txHash || !TX_HASH_RE.test(txHash)) {
    return NextResponse.json(
      { error: 'Invalid or missing txHash' },
      { status: 400 },
    )
  }
  if (!payerAddress || !ETH_ADDRESS_RE.test(payerAddress)) {
    return NextResponse.json(
      { error: 'Invalid or missing payerAddress' },
      { status: 400 },
    )
  }

  const db = getDb()

  // Check link exists
  const rows = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.linkId, id))
    .limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  // Idempotency: check for existing "paid" event with same tx_hash
  const existing = await db
    .select()
    .from(linkEvents)
    .where(
      and(
        eq(linkEvents.linkId, id),
        eq(linkEvents.eventType, 'paid'),
        eq(linkEvents.txHash, txHash),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ success: true, duplicate: true })
  }

  // Log "paid" event
  await logLinkEvent({
    linkId: id,
    eventType: 'paid',
    payerAddress,
    txHash,
  })

  // Increment pay_count — and auto-deactivate if single-use
  const link = rows[0]

  if (link.singleUse) {
    // Single-use: deactivate atomically with pay_count increment
    // WHERE is_active = true guards against race conditions
    await db
      .update(paymentLinks)
      .set({
        payCount: sql`pay_count + 1`,
        isActive: false,
        deactivatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentLinks.linkId, id),
          eq(paymentLinks.isActive, true),
        ),
      )
  } else {
    // Multi-use: increment pay_count only (existing behavior)
    await db
      .update(paymentLinks)
      .set({ payCount: sql`pay_count + 1` })
      .where(eq(paymentLinks.linkId, id))
  }

  // Fire-and-forget: upsert transaction record
  upsertTransactions(
    [
      {
        hash: txHash,
        from: payerAddress.toLowerCase(),
        to: link.recipient.toLowerCase(),
        value: amount ?? '0',
        timeStamp: String(Math.floor(Date.now() / 1000)),
        isError: '0',
        tokenSymbol: token,
        direction: 'in' as const,
      },
    ],
    link.chainId,
  ).catch(() => {})

  return NextResponse.json({ success: true })
}
