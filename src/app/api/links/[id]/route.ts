import { NextRequest, NextResponse } from 'next/server'
import { decodePaymentLink, isDemoLink, DEMO_PAYMENT_DATA } from '@/lib/encode'
import { validatePaymentLink } from '@/lib/validate'
import { verifyPaymentLink } from '@/lib/hmac'

// GET /api/links/[id] — decode and verify a payment link
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (isDemoLink(id)) {
    return NextResponse.json({ id, data: DEMO_PAYMENT_DATA, verified: true, tampered: false })
  }

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

  return NextResponse.json({ id, data, verified: hmacValid, tampered: !hmacValid })
}
