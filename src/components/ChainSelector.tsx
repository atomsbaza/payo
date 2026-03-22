'use client'

import { getSupportedChains } from '@/lib/chainRegistry'
import { useLang } from '@/context/LangContext'

type Props = {
  value: number
  onChange: (chainId: number) => void
}

export function ChainSelector({ value, onChange }: Props) {
  const { t } = useLang()
  const chains = getSupportedChains()

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">{t.labelChain}</label>
      <div className="flex flex-wrap gap-2">
        {chains.map((chain) => (
          <button
            key={chain.chainId}
            type="button"
            onClick={() => onChange(chain.chainId)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium transition-all ${
              value === chain.chainId
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
            }`}
          >
            <span className="text-sm">{chain.name}</span>
            {chain.isTestnet && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-normal">
                {t.testnetBadge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
