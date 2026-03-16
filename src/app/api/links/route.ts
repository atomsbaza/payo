import { NextRequest, NextResponse } from 'next/server'
import { encodePaymentLink, type PaymentLinkData } from '@/lib/encode'

// POST /api/links — encode a payment link payload
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<PaymentLinkData>

    if (!body.address || !body.token) {
      return NextResponse.json({ error: 'address and token are required' }, { status: 400 })
    }

    const data: PaymentLinkData = {
      address: body.address,
      token: body.token,
      amount: body.amount ?? '',
      memo: body.memo ?? '',
      chainId: body.chainId ?? 84532, // Base Sepolia
    }

    const id = encodePaymentLink(data)
    const baseUrl = req.nextUrl.origin
    const url = `${baseUrl}/pay/${id}`

    return NextResponse.json({ id, url, data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
