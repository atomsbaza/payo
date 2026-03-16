import { NextRequest, NextResponse } from 'next/server'
import { decodePaymentLink } from '@/lib/encode'

// GET /api/links/[id] — decode a payment link
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const data = decodePaymentLink(id)

  if (!data) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  return NextResponse.json({ id, data })
}
