import { NextRequest, NextResponse } from 'next/server'

const BASESCAN_API = 'https://api-sepolia.basescan.org/api'

// GET /api/tx/[address] — fetch transaction history from Basescan
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  const apiKey = process.env.BASESCAN_API_KEY ?? ''

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    // Fetch native ETH transactions
    const ethUrl = new URL(BASESCAN_API)
    ethUrl.searchParams.set('module', 'account')
    ethUrl.searchParams.set('action', 'txlist')
    ethUrl.searchParams.set('address', address)
    ethUrl.searchParams.set('sort', 'desc')
    ethUrl.searchParams.set('apikey', apiKey)

    const res = await fetch(ethUrl.toString(), { next: { revalidate: 30 } })
    const json = await res.json()

    if (json.status !== '1') {
      return NextResponse.json({ transactions: [] })
    }

    // Return the 20 most recent inbound transactions
    const incoming = (json.result as Array<{
      to: string
      from: string
      value: string
      hash: string
      timeStamp: string
      isError: string
    }>)
      .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase() && tx.isError === '0')
      .slice(0, 20)

    return NextResponse.json({ transactions: incoming })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
