import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter } from '@/lib/rate-limit'

const BASESCAN_API = 'https://api.etherscan.io/v2/api'
const CHAIN_ID = '84532' // Base Sepolia
const limiter = createRateLimiter(10, 60_000)

export type FeeTx = {
  hash: string
  payer: string       // from address
  payee: string       // the address that originally received the payment (not available from Basescan, set to '')
  feeAmount: string   // raw value string
  tokenSymbol?: string  // undefined for ETH
  tokenDecimal?: string
  timeStamp: string
}

/**
 * Merge ETH and ERC-20 fee transaction lists, sort by timeStamp descending, return top `limit`.
 * Exported for independent testing.
 */
export function mergeFeeTxLists(
  ethTxs: FeeTx[],
  erc20Txs: FeeTx[],
  limit = 50
): FeeTx[] {
  return [...ethTxs, ...erc20Txs]
    .sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
    .slice(0, limit)
}

// GET /api/fees/[address] — fetch fee transactions (sent to the company wallet) from Basescan
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed, retryAfter } = limiter.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const { address } = await params
  const apiKey = process.env.BASESCAN_API_KEY ?? ''

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    // Build internal ETH txlist URL (fee payments from contract are internal txs)
    const internalUrl = new URL(BASESCAN_API)
    internalUrl.searchParams.set('chainid', CHAIN_ID)
    internalUrl.searchParams.set('module', 'account')
    internalUrl.searchParams.set('action', 'txlistinternal')
    internalUrl.searchParams.set('address', address)
    internalUrl.searchParams.set('sort', 'desc')
    internalUrl.searchParams.set('apikey', apiKey)

    // Build normal ETH txlist URL (direct transfers, fallback when no contract)
    const ethUrl = new URL(BASESCAN_API)
    ethUrl.searchParams.set('chainid', CHAIN_ID)
    ethUrl.searchParams.set('module', 'account')
    ethUrl.searchParams.set('action', 'txlist')
    ethUrl.searchParams.set('address', address)
    ethUrl.searchParams.set('sort', 'desc')
    ethUrl.searchParams.set('apikey', apiKey)

    // Build ERC-20 tokentx URL
    const tokenUrl = new URL(BASESCAN_API)
    tokenUrl.searchParams.set('chainid', CHAIN_ID)
    tokenUrl.searchParams.set('module', 'account')
    tokenUrl.searchParams.set('action', 'tokentx')
    tokenUrl.searchParams.set('address', address)
    tokenUrl.searchParams.set('sort', 'desc')
    tokenUrl.searchParams.set('apikey', apiKey)

    // Fetch all three in parallel
    const [internalRes, ethRes, tokenRes] = await Promise.allSettled([
      fetch(internalUrl.toString(), { next: { revalidate: 30 } }).then((r) => r.json()),
      fetch(ethUrl.toString(), { next: { revalidate: 30 } }).then((r) => r.json()),
      fetch(tokenUrl.toString(), { next: { revalidate: 30 } }).then((r) => r.json()),
    ])

    // Parse internal ETH transactions sent *to* the given address (fee splits from contract)
    let internalTxs: FeeTx[] = []
    if (internalRes.status === 'fulfilled' && internalRes.value.status === '1') {
      internalTxs = (internalRes.value.result as Array<{
        to: string; from: string; value: string; hash: string; timeStamp: string; isError: string
      }>)
        .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase() && tx.isError === '0')
        .map((tx) => ({
          hash: tx.hash,
          payer: tx.from,
          payee: '',
          feeAmount: tx.value,
          timeStamp: tx.timeStamp,
        }))
    }

    // Parse normal ETH transactions sent *to* the given address (direct transfers)
    let ethTxs: FeeTx[] = []
    if (ethRes.status === 'fulfilled' && ethRes.value.status === '1') {
      ethTxs = (ethRes.value.result as Array<{
        to: string; from: string; value: string; hash: string; timeStamp: string; isError: string
      }>)
        .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase() && tx.isError === '0')
        .map((tx) => ({
          hash: tx.hash,
          payer: tx.from,
          payee: '',
          feeAmount: tx.value,
          timeStamp: tx.timeStamp,
        }))
    }

    // Deduplicate: internal txs share the same hash as the parent tx, prefer internal
    const internalHashes = new Set(internalTxs.map((tx) => tx.hash))
    ethTxs = ethTxs.filter((tx) => !internalHashes.has(tx.hash))

    // Parse ERC-20 transactions sent *to* the given address (company wallet)
    let erc20Txs: FeeTx[] = []
    if (tokenRes.status === 'fulfilled' && tokenRes.value.status === '1') {
      erc20Txs = (tokenRes.value.result as Array<{
        to: string; from: string; value: string; hash: string; timeStamp: string
        tokenSymbol: string; tokenDecimal: string
      }>)
        .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase())
        .map((tx) => ({
          hash: tx.hash,
          payer: tx.from,
          payee: '',
          feeAmount: tx.value,
          tokenSymbol: tx.tokenSymbol,
          tokenDecimal: tx.tokenDecimal,
          timeStamp: tx.timeStamp,
        }))
    }

    const transactions = mergeFeeTxLists([...internalTxs, ...ethTxs], erc20Txs)
    return NextResponse.json({ transactions })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
