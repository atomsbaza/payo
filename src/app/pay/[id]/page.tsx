'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useReadContract, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther, parseUnits, formatUnits } from 'viem'
import confetti from 'canvas-confetti'
import { decodePaymentLink, isLinkExpired, shortAddress } from '@/lib/encode'
import { validatePaymentLink } from '@/lib/validate'
import { isSelfPayment } from '@/lib/self-payment'
import { getToken, ERC20_ABI } from '@/lib/tokens'
import { calculateFee, formatFeePercent } from '@/lib/fee'
import { CRYPTO_PAY_LINK_ADDRESS, CryptoPayLinkFeeABI, DEFAULT_FEE_RATE } from '@/lib/contract'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { SuccessView } from '@/components/SuccessView'
import { Navbar } from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'
import { useLang } from '@/context/LangContext'

type Props = {
  params: Promise<{ id: string }>
}

export default function PayPage({ params }: Props) {
  const { id } = use(params)
  const { address, isConnected } = useAccount()
  const { t, lang } = useLang()
  const [customAmount, setCustomAmount] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [hmacVerified, setHmacVerified] = useState<boolean | null>(null)

  const data = decodePaymentLink(id)

  // Validate payment link data
  const validation = data ? validatePaymentLink(data) : null
  const isValidData = validation?.valid === true

  const token = data ? getToken(data.token) : undefined

  // Self-payment check
  const selfPayment = data ? isSelfPayment(address, data.address) : false

  // HMAC verification via API
  useEffect(() => {
    if (!id || !isValidData) return
    fetch(`/api/links/${id}`)
      .then((r) => r.json())
      .then((res) => setHmacVerified(res.verified ?? false))
      .catch(() => setHmacVerified(false))
  }, [id, isValidData])

  // Token balance
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: !!address && token?.address === 'native' },
  })
  const { data: erc20Balance } = useReadContract({
    address: token?.address !== 'native' ? token?.address as `0x${string}` : undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token && token.address !== 'native' },
  })

  const balanceRaw = token?.address === 'native' ? ethBalance?.value : (erc20Balance as bigint | undefined)
  const balanceFormatted = balanceRaw !== undefined && token
    ? parseFloat(formatUnits(balanceRaw, token.decimals)).toFixed(token.decimals === 18 ? 4 : 2)
    : null

  // Whether the fee contract is deployed and configured
  const contractReady = !!CRYPTO_PAY_LINK_ADDRESS

  // Read fee rate from the deployed contract; fall back to DEFAULT_FEE_RATE on error
  const { data: contractFeeRate, isError: feeRateError } = useReadContract({
    address: CRYPTO_PAY_LINK_ADDRESS,
    abi: CryptoPayLinkFeeABI,
    functionName: 'feeRate',
    query: { enabled: contractReady },
  })
  const feeRate = contractReady && contractFeeRate !== undefined ? (contractFeeRate as bigint) : DEFAULT_FEE_RATE

  const { writeContractAsync, isPending: isContractPending } = useWriteContract()
  const { sendTransactionAsync, isPending: isDirectPending } = useSendTransaction()
  const isPending = isContractPending || isDirectPending
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const effectiveAmount = data?.amount || customAmount

  // Compute fee breakdown whenever effectiveAmount changes
  const feeBreakdown = useMemo(() => {
    if (!effectiveAmount || !token) return null
    try {
      const totalWei = token.address === 'native'
        ? parseEther(effectiveAmount)
        : parseUnits(effectiveAmount, token.decimals)
      if (totalWei <= 0n) return null
      const { fee, net } = calculateFee(totalWei, feeRate)
      return { total: totalWei, fee, net, feeRate }
    } catch {
      return null
    }
  }, [effectiveAmount, token, feeRate])

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

  // Invalid link or validation failure
  if (!data || !isValidData) {
    const reason = validation && !validation.valid ? validation.reason : undefined
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">❌</p>
          <h1 className="text-xl font-bold mb-2">{t.invalidLink}</h1>
          <p className="text-gray-400">{reason || t.invalidLinkDesc}</p>
        </div>
      </div>
    )
  }

  // Expired link
  if (isLinkExpired(data)) {
    const expiredDate = new Date(data.expiresAt!).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">⏰</p>
          <h1 className="text-xl font-bold mb-2">{t.expiredLink}</h1>
          <p className="text-gray-400">{t.expiredLinkDesc(expiredDate)}</p>
        </div>
      </div>
    )
  }

  // Check insufficient balance
  const isInsufficient = balanceRaw !== undefined && effectiveAmount
    ? balanceRaw < (token?.address === 'native'
        ? parseEther(effectiveAmount)
        : parseUnits(effectiveAmount, token?.decimals ?? 18))
    : false

  async function handlePay() {
    if (!effectiveAmount || !token || !data) return
    setError('')
    try {
      let hash: `0x${string}`

      if (contractReady) {
        // Use the fee contract
        if (token.address === 'native') {
          hash = await writeContractAsync({
            address: CRYPTO_PAY_LINK_ADDRESS,
            abi: CryptoPayLinkFeeABI,
            functionName: 'payNative',
            args: [data.address as `0x${string}`, data.memo || ''],
            value: parseEther(effectiveAmount),
          })
        } else {
          hash = await writeContractAsync({
            address: CRYPTO_PAY_LINK_ADDRESS,
            abi: CryptoPayLinkFeeABI,
            functionName: 'payToken',
            args: [
              data.address as `0x${string}`,
              token.address as `0x${string}`,
              parseUnits(effectiveAmount, token.decimals),
              data.memo || '',
            ],
          })
        }
      } else {
        // Fallback: direct transfer (no fee contract deployed)
        if (token.address === 'native') {
          hash = await sendTransactionAsync({
            to: data.address as `0x${string}`,
            value: parseEther(effectiveAmount),
          })
        } else {
          hash = await writeContractAsync({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [data.address as `0x${string}`, parseUnits(effectiveAmount, token.decimals)],
          })
        }
      }

      setTxHash(hash)
    } catch (err: unknown) {
      setRetryCount(c => c + 1)
      if (err instanceof Error) {
        const msg = err.message
        if (msg.includes('User rejected') || msg.includes('user rejected'))
          setError(t.errorRejected)
        else if (msg.includes('insufficient funds') || msg.includes('InsufficientFunds'))
          setError(t.errorInsufficientFunds)
        else if (msg.includes('network') || msg.includes('Network') || msg.includes('timeout'))
          setError(t.errorNetwork)
        else
          setError(t.errorGeneric)
      }
    }
  }

  if (isSuccess && txHash) {
    return (
      <SuccessView
        amount={effectiveAmount}
        token={data.token}
        recipientAddress={data.address}
        txHash={txHash}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isConnected && <WrongNetworkBanner />}

      <Navbar />

      <main className="max-w-sm mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {hmacVerified === null ? (
          /* Skeleton payment card */
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6" data-testid="pay-skeleton">
            <div className="text-center mb-5">
              <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto mb-3" />
              <Skeleton className="h-5 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </div>
        ) : (
        <>
        {/* Payment card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">💸</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold">
              {data.amount
                ? t.payTitle(data.amount, data.token)
                : t.payTitleNoAmount(data.token)}
            </h1>
            {data.memo && (
              <p className="text-gray-400 mt-1 text-sm">"{data.memo}"</p>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelRecipient}</span>
              <span className="font-mono text-gray-200 text-xs sm:text-sm">{shortAddress(data.address)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelTokenField}</span>
              <span className="font-medium">{data.token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelNetwork}</span>
              <span className="text-green-400 text-xs">{t.networkName}</span>
            </div>
            {data.expiresAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t.labelExpiry}</span>
                <span className="text-amber-400 text-xs">
                  ⏰ {new Date(data.expiresAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                </span>
              </div>
            )}
          </div>

          {/* Fee breakdown */}
          {feeBreakdown && token && contractReady && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-sm">
              {feeRateError && (
                <p className="text-amber-400 text-xs mb-2">⚠️ Could not read fee rate from contract, using default</p>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Fee rate</span>
                <span className="text-gray-300">{formatFeePercent(feeRate)}</span>
              </div>
              {feeBreakdown.fee === 0n ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee</span>
                  <span className="text-green-400">No fee</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total</span>
                    <span className="text-gray-200">{formatUnits(feeBreakdown.total, token.decimals)} {data.token}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fee</span>
                    <span className="text-amber-400">-{formatUnits(feeBreakdown.fee, token.decimals)} {data.token}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recipient gets</span>
                    <span className="text-green-400">{formatUnits(feeBreakdown.net, token.decimals)} {data.token}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Custom amount if not fixed */}
        {!data.amount && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.labelCustomAmount}</label>
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

        {/* Token balance */}
        {isConnected && balanceFormatted !== null && (
          <div className={`mb-4 flex items-center justify-between px-4 py-2.5 rounded-xl text-sm border ${
            isInsufficient
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-white/5 border-white/10 text-gray-400'
          }`}>
            <span>{t.labelBalance}</span>
            <span className={`font-medium ${isInsufficient ? 'text-red-400' : 'text-white'}`}>
              {balanceFormatted} {data.token}
              {isInsufficient && <span className="ml-2 text-xs">⚠️ {t.insufficientBalance}</span>}
            </span>
          </div>
        )}

        {/* HMAC tampered warning */}
        {hmacVerified === false && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
            <p className="text-amber-400">⚠️ This link may have been tampered with. Proceed with caution.</p>
          </div>
        )}

        {/* Self-payment warning */}
        {selfPayment && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
            <p className="text-amber-400">⚠️ You are about to pay yourself. This transaction would waste gas fees.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm">
            <p className="text-red-400 mb-3">{error}</p>
            {retryCount > 0 && (
              <p className="text-red-400/60 text-xs mb-3">{t.retryCount(retryCount)}</p>
            )}
            <button
              onClick={() => { setError(''); handlePay() }}
              className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors"
            >
              🔄 {t.retryBtn}
            </button>
          </div>
        )}

        {/* Action */}
        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectButton label={t.connectToPayBtn} />
          </div>
        ) : (
          <button
            onClick={handlePay}
            disabled={!effectiveAmount || isPending || isConfirming || isInsufficient || selfPayment}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors text-sm sm:text-base"
          >
            {isConfirming
              ? t.waitingConfirm
              : isPending
              ? t.waitingWallet
              : t.payBtn(effectiveAmount || '?', data.token)}
          </button>
        )}
        </>
        )}
      </main>
    </div>
  )
}
