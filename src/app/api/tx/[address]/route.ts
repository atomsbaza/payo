import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter } from '@/lib/rate-limit'

const BASESCAN_API = 'https://api.etherscan.io/v2/api'
const CHAIN_ID = '84532' // Base Sepolia
const limiter = createRateLimiter(10, 60_000)

export type UnifiedTx = {
  hash: string
  from: string
  to: string
  value: string        // raw value (wei or smallest unit)
  timeStamp: string
  isError: string
  tokenSymbol?: string  // "USDC" for ERC-20, undefined for ETH
  tokenDecimal?: string // "6" for USDC, undefined for ETH
  direction: 'in' | 'out'
}

/**
 * Merge ETH, internal ETH, and ERC-20 transaction lists,
 * sort by timeStamp descending, return top `limit`.
 * Exported for independent testing.
 */
export function mergeTxLists(
  ...lists: UnifiedTx[][]
): UnifiedTx[] {
  // Deduplicate by hash+direction (internal txs can share hash with normal txs)
  const seen = new Set<string>()
  const merged: UnifiedTx[] = []
  for (const list of lists) {
    for (const tx of list) {
      const key = `${tx.hash}-${tx.direction}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(tx)
      }
    }
  }
  return merged
    .sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
    .slice(0, 50)
}

type RawTx = {
  to: string; from: string; value: string; hash: string; timeStamp: string; isError: string
}
type RawTokenTx = RawTx & { tokenSymbol: string; tokenDecimal: string }

function mapTxs(
  txs: RawTx[],
  address: string,
): UnifiedTx[] {
  const addr = address.toLowerCase()
  return txs
    .filter((tx) => tx.isError === '0' && (tx.to?.toLowerCase() === addr || tx.from?.toLowerCase() === addr))
    .map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      timeStamp: tx.timeStamp,
      isError: tx.isError,
      direction: tx.to?.toLowerCase() === addr ? 'in' as const : 'out' as const,
    }))
}

function mapTokenTxs(
  txs: RawTokenTx[],
  address: string,
): UnifiedTx[] {
  const addr = address.toLowerCase()
  return txs
    .filter((tx) => tx.to?.toLowerCase() === addr || tx.from?.toLowerCase() === addr)
    .map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      timeStamp: tx.timeStamp,
      isError: '0',
      tokenSymbol: tx.tokenSymbol,
      tokenDecimal: tx.tokenDecimal,
      direction: tx.to?.toLowerCase() === addr ? 'in' as const : 'out' as const,
    }))
}

// GET /api/tx/[address] — fetch transaction history from Basescan
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
    // Normal ETH transactions
    const ethUrl = new URL(BASESCAN_API)
    ethUrl.searchParams.set('chainid', CHAIN_ID)
    ethUrl.searchParams.set('module', 'account')
    ethUrl.searchParams.set('action', 'txlist')
    ethUrl.searchParams.set('address', address)
    ethUrl.searchParams.set('sort', 'desc')
    ethUrl.searchParams.set('apikey', apiKey)

    // Internal ETH transactions (from contract calls like fee splits)
    const internalUrl = new URL(BASESCAN_API)
    internalUrl.searchParams.set('chainid', CHAIN_ID)
    internalUrl.searchParams.set('module', 'account')
    internalUrl.searchParams.set('action', 'txlistinternal')
    internalUrl.searchParams.set('address', address)
    internalUrl.searchParams.set('sort', 'desc')
    internalUrl.searchParams.set('apikey', apiKey)

    // ERC-20 token transactions
    const tokenUrl = new URL(BASESCAN_API)
    tokenUrl.searchParams.set('chainid', CHAIN_ID)
    tokenUrl.searchParams.set('module', 'account')
    tokenUrl.searchParams.set('action', 'tokentx')
    tokenUrl.searchParams.set('address', address)
    tokenUrl.searchParams.set('sort', 'desc')
    tokenUrl.searchParams.set('apikey', apiKey)

    const [ethRes, internalRes, tokenRes] = await Promise.allSettled([
      fetch(ethUrl.toString(), { next: { revalidate: 30 } }).then((r) => r.json()),
      fetch(internalUrl.toString(), { next: { revalidate: 30 } }).then((r) => r.json()),
      fetch(tokenUrl.toString(), { next: { revalidate: 30 } }).then((r) => r.json()),
    ])

    let ethTxs: UnifiedTx[] = []
    if (ethRes.status === 'fulfilled' && ethRes.value.status === '1') {
      ethTxs = mapTxs(ethRes.value.result, address)
    }

    let internalTxs: UnifiedTx[] = []
    if (internalRes.status === 'fulfilled' && internalRes.value.status === '1') {
      internalTxs = mapTxs(internalRes.value.result, address)
    }

    let erc20Txs: UnifiedTx[] = []
    if (tokenRes.status === 'fulfilled' && tokenRes.value.status === '1') {
      erc20Txs = mapTokenTxs(tokenRes.value.result, address)
    }

    const transactions = mergeTxLists(internalTxs, ethTxs, erc20Txs)
    return NextResponse.json({ transactions })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
