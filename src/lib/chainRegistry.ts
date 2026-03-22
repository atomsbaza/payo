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

export function getSupportedChains(): SupportedChain[] {
  return CHAINS
}

export function getChain(chainId: number): SupportedChain | undefined {
  return CHAINS.find(c => c.chainId === chainId)
}
