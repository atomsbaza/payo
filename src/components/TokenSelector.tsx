'use client'

import { useEffect } from 'react'
import { getTokensForChain } from '@/lib/tokenRegistry'

type Props = {
  value: string
  onChange: (symbol: string) => void
  chainId: number
}

export function TokenSelector({ value, onChange, chainId }: Props) {
  const tokens = getTokensForChain(chainId)

  useEffect(() => {
    const tokens = getTokensForChain(chainId)
    if (!tokens.find(t => t.symbol === value)) {
      onChange('ETH')
    }
  }, [chainId])

  return (
    <div className="flex gap-2 flex-wrap">
      {tokens.map((token) => (
        <button
          key={token.symbol}
          type="button"
          onClick={() => onChange(token.symbol)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium transition-all ${
            value === token.symbol
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
              : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
          }`}
        >
          <span className="text-sm">{token.symbol}</span>
          <span className="text-xs text-gray-500">{token.name}</span>
        </button>
      ))}
    </div>
  )
}
