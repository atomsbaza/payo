import type { Token } from './tokens'

// Token data per chain — stablecoins listed first
// Base Sepolia (84532) - testnet: USDC, ETH
// Base Mainnet (8453) - USDC, USDT, DAI, ETH, cbBTC
// Optimism (10) - USDC, USDT, DAI, ETH
// Arbitrum One (42161) - USDC, USDT, DAI, ETH

const ETH: Token = {
  symbol: 'ETH',
  name: 'Ethereum',
  address: 'native',
  decimals: 18,
  logoUrl: '/tokens/eth.svg',
}

const TOKENS_BY_CHAIN: Record<number, Token[]> = {
  // Base Sepolia (testnet)
  84532: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      decimals: 6,
      logoUrl: '/tokens/usdc.svg',
    },
    ETH,
  ],

  // Base Mainnet
  8453: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      logoUrl: '/tokens/usdc.svg',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      decimals: 6,
      logoUrl: '/tokens/usdt.svg',
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      decimals: 18,
      logoUrl: '/tokens/dai.svg',
    },
    ETH,
    {
      symbol: 'cbBTC',
      name: 'Coinbase Wrapped BTC',
      address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      decimals: 8,
      logoUrl: '/tokens/cbbtc.svg',
    },
  ],

  // Optimism
  10: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      decimals: 6,
      logoUrl: '/tokens/usdc.svg',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      decimals: 6,
      logoUrl: '/tokens/usdt.svg',
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
      logoUrl: '/tokens/dai.svg',
    },
    ETH,
  ],

  // Arbitrum One
  42161: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
      logoUrl: '/tokens/usdc.svg',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
      logoUrl: '/tokens/usdt.svg',
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
      logoUrl: '/tokens/dai.svg',
    },
    ETH,
  ],
}

export type { Token }

export function getTokensForChain(chainId: number): Token[] {
  return TOKENS_BY_CHAIN[chainId] ?? []
}

export function getToken(chainId: number, symbol: string): Token | undefined {
  return TOKENS_BY_CHAIN[chainId]?.find(t => t.symbol === symbol)
}

export function getDefaultToken(chainId: number): string {
  const tokens = getTokensForChain(chainId)
  return tokens[0]?.symbol ?? 'USDC'
}
