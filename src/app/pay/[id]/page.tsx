'use client'

import { use, useEffect, useState } from 'react'
import { useAccount, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther, parseUnits } from 'viem'
import confetti from 'canvas-confetti'
import { decodePaymentLink, shortAddress } from '@/lib/encode'
import { getToken, ERC20_ABI } from '@/lib/tokens'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'

type Props = {
  params: Promise<{ id: string }>
}

export default function PayPage({ params }: Props) {
  const { id } = use(params)
  const { isConnected } = useAccount()
  const [customAmount, setCustomAmount] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState('')

  const data = decodePaymentLink(id)

  const { sendTransactionAsync, isPending: isEthPending } = useSendTransaction()
  const { writeContractAsync, isPending: isErc20Pending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Confetti on success 🎉
  useEffect(() => {
    if (!isSuccess) return
    const end = Date.now() + 2000
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#22d3ee']
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [isSuccess])

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">❌</p>
          <h1 className="text-xl font-bold mb-2">Payment link ไม่ถูกต้อง</h1>
          <p className="text-gray-400">ลิงก์นี้อาจหมดอายุหรือเสียหาย</p>
        </div>
      </div>
    )
  }

  const token = getToken(data.token)
  const effectiveAmount = data.amount || customAmount
  const isPending = isEthPending || isErc20Pending

  async function handlePay() {
    if (!effectiveAmount || !token) return
    setError('')
    try {
      let hash: `0x${string}`
      if (token.address === 'native') {
        hash = await sendTransactionAsync({
          to: data!.address as `0x${string}`,
          value: parseEther(effectiveAmount),
        })
      } else {
        hash = await writeContractAsync({
          address: token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [data!.address as `0x${string}`, parseUnits(effectiveAmount, token.decimals)],
        })
      }
      setTxHash(hash)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(
          err.message.includes('User rejected') ? 'ยกเลิกการโอน' : err.message.slice(0, 120)
        )
      }
    }
  }

  if (isSuccess && txHash) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">
          <div className="text-7xl mb-4">🎉</div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">โอนสำเร็จ!</h1>
          <p className="text-gray-400 mb-2">
            <span className="text-white font-semibold">{effectiveAmount} {data.token}</span>{' '}
            ถึงมือผู้รับแล้ว
          </p>
          <p className="text-xs text-gray-600 mb-6 font-mono">{shortAddress(data.address)}</p>
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm transition-colors"
          >
            ดู Transaction บน Basescan ↗
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Wrong network banner */}
      {isConnected && <WrongNetworkBanner />}

      {/* Navbar */}
      <nav className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-indigo-400">⚡</span>
          <span className="font-bold text-base sm:text-lg">Crypto Pay Link</span>
        </div>
        <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
      </nav>

      <main className="max-w-sm mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Payment card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">💸</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold">
              {data.amount ? `โอน ${data.amount} ${data.token}` : `โอน ${data.token}`}
            </h1>
            {data.memo && (
              <p className="text-gray-400 mt-1 text-sm">"{data.memo}"</p>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ผู้รับ</span>
              <span className="font-mono text-gray-200 text-xs sm:text-sm">{shortAddress(data.address)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Token</span>
              <span className="font-medium">{data.token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Network</span>
              <span className="text-green-400 text-xs">Base Sepolia (Testnet)</span>
            </div>
          </div>
        </div>

        {/* Custom amount if not fixed */}
        {!data.amount && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">จำนวนที่จะโอน</label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                min="0"
                step="any"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {data.token}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Action */}
        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectButton label="Connect Wallet เพื่อโอน" />
          </div>
        ) : (
          <button
            onClick={handlePay}
            disabled={!effectiveAmount || isPending || isConfirming}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors text-sm sm:text-base"
          >
            {isConfirming
              ? '⏳ รอ confirmation...'
              : isPending
              ? '⏳ รอ approve ใน wallet...'
              : `โอน ${effectiveAmount || '?'} ${data.token} →`}
          </button>
        )}
      </main>
    </div>
  )
}
