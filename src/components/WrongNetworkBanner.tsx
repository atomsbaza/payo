'use client'

import { useChainId, useSwitchChain } from 'wagmi'
import { getChain, getDefaultChainId } from '@/lib/chainRegistry'
import { useLang } from '@/context/LangContext'

type Props = {
  expectedChainId?: number
}

export function WrongNetworkBanner({ expectedChainId = getDefaultChainId() }: Props) {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const { t } = useLang()

  if (chainId === expectedChainId) return null

  const chainName = getChain(expectedChainId)?.name ?? String(expectedChainId)

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
      <span className="text-amber-400">⚠️ Please switch network to {chainName}</span>
      <button
        onClick={() => switchChain({ chainId: expectedChainId })}
        disabled={isPending}
        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition-colors"
      >
        {isPending ? t.switching : t.switchNetwork}
      </button>
    </div>
  )
}
