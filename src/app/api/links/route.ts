import { NextRequest, NextResponse } from 'next/server'
import { encodePaymentLink, type PaymentLinkData } from '@/lib/encode'
import { CreateLinkRequestSchema, validateChainId, validatePaymentLink } from '@/lib/validate'
import { signPaymentLink } from '@/lib/hmac'
import { createRateLimiter } from '@/lib/rate-limit'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { paymentLinks, users } from '@/lib/schema'
import { count, eq } from 'drizzle-orm'

const limiter = createRateLimiter(20, 60_000)

// In-memory counter — used as fallback when DATABASE_URL is not configured.
let linkCount = 0

// GET /api/links — return the number of links created
export async function GET() {
  if (isDatabaseConfigured()) {
    try {
      const db = getDb()
      const result = await db
        .select({ value: count() })
        .from(paymentLinks)
        .where(eq(paymentLinks.isActive, true))
      return NextResponse.json({ count: result[0]?.value ?? 0 })
    } catch {
      // If DB query fails, fall back to in-memory counter
      return NextResponse.json({ count: linkCount })
    }
  }
  return NextResponse.json({ count: linkCount })
}


// POST /api/links — encode a payment link payload
export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed, retryAfter } = await limiter.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const body = await req.json()
    const result = CreateLinkRequestSchema.safeParse(body)

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const validated = result.data

    // Validate chain and token against registry
    const chainTokenValidation = validatePaymentLink({
      address: validated.address,
      token: validated.token,
      amount: validated.amount,
      memo: validated.memo,
      chainId: validated.chainId,
      ...(validated.expiresAt ? { expiresAt: validated.expiresAt } : {}),
    })
    if (!chainTokenValidation.valid) {
      return NextResponse.json({ error: chainTokenValidation.reason }, { status: 400 })
    }

    // Truncate memo to 200 chars
    const memo = validated.memo.slice(0, 200)

    const data: PaymentLinkData = {
      address: validated.address,
      token: validated.token,
      amount: validated.amount,
      memo,
      chainId: validated.chainId,
      ...(validated.expiresAt ? { expiresAt: validated.expiresAt } : {}),
    }

    // Sign with HMAC
    const signature = signPaymentLink(data)
    const signedData: PaymentLinkData = { ...data, signature }

    const id = encodePaymentLink(signedData)
    const baseUrl = req.nextUrl.origin
    const url = `${baseUrl}/pay/${id}`

    // Persist to database if configured, otherwise fall back to in-memory counter
    if (isDatabaseConfigured()) {
      // Validate chain_id before inserting (mirrors DB CHECK constraint)
      const chainIdCheck = validateChainId(validated.chainId)
      if (!chainIdCheck.valid) {
        return NextResponse.json({ error: chainIdCheck.reason }, { status: 400 })
      }

      try {
        const db = getDb()
        await db.insert(paymentLinks).values({
          linkId: id,
          ownerAddress: validated.address,
          recipient: validated.address,
          token: validated.token,
          chainId: validated.chainId,
          amount: validated.amount || null,
          memo: memo || null,
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
          signature: signature,
          singleUse: validated.singleUse ?? false,
        }).onConflictDoUpdate({
          target: paymentLinks.linkId,
          set: { updatedAt: new Date() },
        })

        // Fire-and-forget user upsert — don't block the response
        db.insert(users)
          .values({ address: validated.address, lastSeen: new Date() })
          .onConflictDoUpdate({ target: users.address, set: { lastSeen: new Date() } })
          .catch(() => {})
      } catch {
        return NextResponse.json(
          { error: 'Failed to create payment link' },
          { status: 500 },
        )
      }
    } else {
      linkCount++
    }

    return NextResponse.json({ id, url, data: signedData })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
