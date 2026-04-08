import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { coinbaseWallet, metaMaskWallet, rainbowWallet, trustWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { baseSepolia, base, optimism, arbitrum } from 'wagmi/chains'
import { getSupportedChains } from './chainRegistry'
import type { Chain } from 'viem'

// Map chain IDs to wagmi chain objects
const WAGMI_CHAIN_MAP: Record<number, Chain> = {
  84532: baseSepolia,
  8453: base,
  10: optimism,
  42161: arbitrum,
}

// Set smartWalletOnly preference before config creation
// This ensures Coinbase Smart Wallet uses passkey/email flow
coinbaseWallet.preference = 'smartWalletOnly'

const activeChains = getSupportedChains()
  .map(c => WAGMI_CHAIN_MAP[c.chainId])
  .filter(Boolean) as [Chain, ...Chain[]]

export const config = getDefaultConfig({
  appName: 'Crypto Transfer Link',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: activeChains,
  ssr: true,
  wallets: [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet],
    },
    {
      groupName: 'More',
      wallets: [trustWallet, walletConnectWallet],
    },
  ],
})

export { activeChains }
