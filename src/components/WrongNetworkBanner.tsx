'use client'

import { useChainId, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export function WrongNetworkBanner() {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  if (chainId === baseSepolia.id) return null

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
      <span className="text-amber-400">⚠️ กรุณาเปลี่ยน network เป็น Base Sepolia</span>
      <button
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        disabled={isPending}
        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition-colors"
      >
        {isPending ? 'กำลังเปลี่ยน...' : 'Switch Network'}
      </button>
    </div>
  )
}
