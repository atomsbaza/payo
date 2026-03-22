import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia, mainnet } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Crypto Pay Link',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [baseSepolia, mainnet],
  ssr: true,
})

export { baseSepolia as defaultChain }
