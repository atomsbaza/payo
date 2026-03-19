import { NextRequest, NextResponse } from 'next/server'
import { encodePaymentLink, type PaymentLinkData } from '@/lib/encode'
import { CreateLinkRequestSchema } from '@/lib/validate'
import { signPaymentLink } from '@/lib/hmac'
import { createRateLimiter } from '@/lib/rate-limit'

const limiter = createRateLimiter(20, 60_000)

// POST /api/links — encode a payment link payload
export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed, retryAfter } = limiter.check(ip)
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

    return NextResponse.json({ id, url, data: signedData })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
