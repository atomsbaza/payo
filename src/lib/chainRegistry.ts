export type SupportedChain = {
  chainId: number
  name: string
  nativeCurrency: string
  blockExplorerUrl: string
  isTestnet: boolean
}

const CHAINS: SupportedChain[] = [
  {
    chainId: 84532,
    name: 'Base Sepolia',
    nativeCurrency: 'ETH',
    blockExplorerUrl: 'https://sepolia.basescan.org',
    isTestnet: true,
  },
  {
    chainId: 8453,
    name: 'Base Mainnet',
    nativeCurrency: 'ETH',
    blockExplorerUrl: 'https://basescan.org',
    isTestnet: false,
  },
  {
    chainId: 10,
    name: 'Optimism',
    nativeCurrency: 'ETH',
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    isTestnet: false,
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    nativeCurrency: 'ETH',
    blockExplorerUrl: 'https://arbiscan.io',
    isTestnet: false,
  },
]

export function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production'
}

export function getSupportedChains(): SupportedChain[] {
  if (isProduction()) {
    return CHAINS.filter(c => !c.isTestnet)
  }
  return CHAINS
}

export function getChain(chainId: number): SupportedChain | undefined {
  if (isProduction()) {
    return CHAINS.find(c => c.chainId === chainId && !c.isTestnet)
  }
  return CHAINS.find(c => c.chainId === chainId)
}

export function getDefaultChainId(): number {
  return isProduction() ? 8453 : 84532
}
