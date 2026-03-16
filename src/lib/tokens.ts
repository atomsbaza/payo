export type Token = {
  symbol: string
  name: string
  address: `0x${string}` | 'native'
  decimals: number
  logoUrl: string
}

// Base Sepolia testnet token addresses
export const TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: 'native',
    decimals: 18,
    logoUrl: 'https://token-icons.s3.amazonaws.com/eth.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    decimals: 6,
    logoUrl: 'https://token-icons.s3.amazonaws.com/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
  },
]

export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export function getToken(symbol: string): Token | undefined {
  return TOKENS.find((t) => t.symbol === symbol)
}
