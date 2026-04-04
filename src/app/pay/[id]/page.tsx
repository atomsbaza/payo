'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useReadContract, useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit'
import { parseEther, parseUnits, formatUnits } from 'viem'
import confetti from 'canvas-confetti'
import { decodePaymentLink, isLinkExpired, shortAddress, isDemoLink, DEMO_PAYMENT_DATA } from '@/lib/encode'
import { validatePaymentLink } from '@/lib/validate'
import { isSelfPayment } from '@/lib/self-payment'
import { ERC20_ABI } from '@/lib/tokens'
import { getToken } from '@/lib/tokenRegistry'
import { getChain, isProduction } from '@/lib/chainRegistry'
import { calculateFee, formatFeePercent } from '@/lib/fee'
import { getContractAddress, CRYPTO_PAY_LINK_ADDRESS, CryptoPayLinkFeeABI, DEFAULT_FEE_RATE } from '@/lib/contract'
import { buildReceiptData, type ReceiptData } from '@/lib/receiptData'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'
import { SuccessView } from '@/components/SuccessView'
import { Navbar } from '@/components/Navbar'
import Skeleton from '@/components/Skeleton'
import { BlockedScreen } from '@/components/BlockedScreen'
import { Jazzicon } from '@/components/Jazzicon'
import { useLang } from '@/context/LangContext'
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice'
import { calculateFiatValue } from '@/lib/fiatCalc'
import { isMobileBrowser } from '@/lib/mobileDetect'

type Props = {
  params: Promise<{ id: string }>
}

export default function PayPage({ params }: Props) {
  const { id } = use(params)
  const { address, isConnected } = useAccount()
  const { t, lang } = useLang()
  const { openConnectModal } = useConnectModal()
  const isMobile = isMobileBrowser()
  const [customAmount, setCustomAmount] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [hmacVerified, setHmacVerified] = useState<boolean | null>(null)
  const [tampered, setTampered] = useState<boolean | null>(null)
  const [addressCopied, setAddressCopied] = useState(false)
  const [confirmedAt, setConfirmedAt] = useState<number>(0)
  const [pollStartTime, setPollStartTime] = useState<number>(0)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [feeExpanded, setFeeExpanded] = useState(false)
  const [linkDeactivated, setLinkDeactivated] = useState(false)

  const data = isDemoLink(id) ? DEMO_PAYMENT_DATA : decodePaymentLink(id)

  // ENS name resolution (mainnet only)
  const { data: ensName } = useEnsName({
    address: data?.address as `0x${string}`,
    chainId: mainnet.id,
    query: { enabled: !!data?.address },
  })

  // Validate payment link data
  const validation = data ? validatePaymentLink(data) : null
  const isValidData = validation?.valid === true

  const token = data ? getToken(data.chainId, data.token) : undefined
  const chain = data ? getChain(data.chainId) : undefined
  const isTestnetInProd = isProduction() && chain?.isTestnet

  // Resolve contract address for the payment link's chain (fallback to legacy constant)
  const contractAddress = (data ? getContractAddress(data.chainId) : undefined) ?? CRYPTO_PAY_LINK_ADDRESS

  // Self-payment check
  const selfPayment = data ? isSelfPayment(address, data.address) : false

  // CoinGecko fiat price
  const coinGeckoPrice = useCoinGeckoPrice(data?.token ?? '')

  // HMAC verification via API
  useEffect(() => {
    if (!id || !isValidData) return
    fetch(`/api/links/${id}`)
      .then((r) => r.json())
      .then((res) => {
        setHmacVerified(res.verified ?? false)
        setTampered(res.tampered ?? true)
        if (res.isActive === false) {
          setLinkDeactivated(true)
        }
      })
      .catch(() => {
        setHmacVerified(false)
        setTampered(true)
      })
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
  const contractReady = !!contractAddress

  // Read fee rate from the deployed contract; fall back to DEFAULT_FEE_RATE on error
  const { data: contractFeeRate, isError: feeRateError } = useReadContract({
    address: contractAddress,
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

  // Capture timestamp when transaction confirms
  useEffect(() => {
    if (isSuccess && confirmedAt === 0) {
      setConfirmedAt(Date.now())
    }
  }, [isSuccess])

  // Start poll timer when txHash is set
  useEffect(() => {
    if (txHash && !pollStartTime) {
      setPollStartTime(Date.now())
    }
  }, [txHash])

  // Timeout check (120 seconds)
  useEffect(() => {
    if (!txHash || isSuccess || pollTimedOut) return
    const interval = setInterval(() => {
      if (Date.now() - pollStartTime > 120_000) {
        setPollTimedOut(true)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [txHash, isSuccess, pollStartTime, pollTimedOut])

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

  // Blocked screen for deactivated (single-use) links
  if (linkDeactivated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">🔒</p>
          <h1 className="text-xl font-bold mb-2">{t.linkUsedTitle}</h1>
          <p className="text-gray-400 mb-6">{t.linkUsedDesc}</p>
          <a href="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm">
            {t.tamperedGoHome}
          </a>
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

  async function handleCopyAddress() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.address)
      setAddressCopied(true)
      setTimeout(() => setAddressCopied(false), 2000)
    } catch {
      // silent fail
    }
  }

  async function handlePay() {
    if (!effectiveAmount || !token || !data) return
    setError('')
    try {
      let hash: `0x${string}`

      if (contractReady) {
        // Use the fee contract
        if (token.address === 'native') {
          hash = await writeContractAsync({
            address: contractAddress!,
            abi: CryptoPayLinkFeeABI,
            functionName: 'payNative',
            args: [data.address as `0x${string}`, data.memo || ''],
            value: parseEther(effectiveAmount),
          })
        } else {
          hash = await writeContractAsync({
            address: contractAddress!,
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
    const receiptData: ReceiptData = buildReceiptData({
      payerAddress: address ?? '',
      recipientAddress: data.address,
      tokenSymbol: token?.symbol ?? data.token,
      tokenName: token?.name ?? data.token,
      amount: effectiveAmount,
      chainName: chain?.name ?? String(data.chainId),
      chainId: data.chainId,
      txHash,
      blockExplorerUrl: chain?.blockExplorerUrl ?? 'https://sepolia.basescan.org',
      memo: data.memo ?? '',
      confirmedAt,
      feeTotal: feeBreakdown ? feeBreakdown.total.toString() : '0',
      feeAmount: feeBreakdown ? feeBreakdown.fee.toString() : '0',
      feeNet: feeBreakdown ? feeBreakdown.net.toString() : '0',
      feeRateBps: feeBreakdown ? feeBreakdown.feeRate.toString() : '0',
      tokenDecimals: token?.decimals ?? 18,
    })

    return (
      <SuccessView
        amount={effectiveAmount}
        token={data.token}
        recipientAddress={data.address}
        txHash={txHash}
        blockExplorerUrl={chain?.blockExplorerUrl ?? 'https://sepolia.basescan.org'}
        confirmedAt={confirmedAt}
        receiptData={receiptData}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {isConnected && <WrongNetworkBanner expectedChainId={data.chainId} />}

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
        ) : tampered === true ? (
          <BlockedScreen />
        ) : (
        <>
        {/* Payment card */}
        <div className="bg-white/[0.03] ring-1 ring-white/10 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6">
          {isTestnetInProd && (
            <div
              role="alert"
              data-testid="testnet-prod-warning"
              className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center"
            >
              <p className="text-red-400 text-sm font-semibold">⚠️ Testnet Link</p>
              <p className="text-red-400/80 text-xs mt-1">
                This payment link uses a testnet chain ({chain?.name}). Testnet tokens have no real value.
              </p>
            </div>
          )}
          {chain?.isTestnet && !isTestnetInProd && (
            <div
              role="status"
              className="mb-3 text-center"
            >
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                TESTNET
              </span>
            </div>
          )}
          <div className="text-center mb-5">
            <div className="flex items-center justify-center mx-auto mb-3">
              <Jazzicon address={data.address} size={56} />
            </div>
            <h1 className="text-lg sm:text-xl font-bold">
              {data.amount
                ? t.payTitle(data.amount, data.token)
                : t.payTitleNoAmount(data.token)}
              {data.amount && coinGeckoPrice !== null && (() => {
                const fiat = calculateFiatValue(data.amount, coinGeckoPrice)
                return fiat ? <span className="text-gray-400 text-sm font-normal ml-2">≈ ${fiat}</span> : null
              })()}
            </h1>
            {data.memo && (
              <p className="text-gray-400 mt-1 text-sm">"{data.memo}"</p>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t.labelRecipient}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col items-end">
                  {ensName ? (
                    <>
                      <span className="font-medium text-indigo-400 text-sm">{ensName}</span>
                      <span className="font-mono text-gray-500 text-xs">{shortAddress(data.address)}</span>
                    </>
                  ) : (
                    <span className="font-mono text-gray-200 text-xs sm:text-sm">
                      {shortAddress(data.address)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label={t.copyAddress}
                >
                  {addressCopied ? '✓' : '📋'}
                </button>
                {chain && (
                  <a
                    href={`${chain.blockExplorerUrl}/address/${data.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label={t.viewOnExplorer}
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelTokenField}</span>
              <span className="font-medium">{data.token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.labelNetwork}</span>
              <span className="text-green-400 text-xs">{chain?.name ?? String(data.chainId)}</span>
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

          {/* Fee breakdown toggle */}
          {feeBreakdown && token && contractReady && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => setFeeExpanded(!feeExpanded)}
                aria-expanded={feeExpanded}
                className="w-full flex justify-between items-center text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span>{feeExpanded ? t.hideFeeBreakdown : t.showFeeBreakdown}</span>
                <span>{feeExpanded ? '▴' : '▾'}</span>
              </button>

              {feeExpanded && (
                <div className="mt-3 space-y-2 text-sm">
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
          )}
        </div>

        {/* Custom amount if not fixed */}
        {!data.amount && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">{t.labelCustomAmount}</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
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

        {/* Gas-for-ERC20 tooltip */}
        {isConnected && token?.address !== 'native' && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-sm bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            ℹ️ {t.gasForErc20}
          </div>
        )}

        {/* Polling progress indicator */}
        {txHash && !isSuccess && !pollTimedOut && (
          <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm text-center">
            <div className="animate-pulse mb-2">⏳</div>
            <p className="text-indigo-400">{t.waitingForConfirmation}</p>
            <p className="text-gray-500 text-xs mt-1">{t.confirmationProgress}</p>
          </div>
        )}

        {/* Polling timeout message */}
        {pollTimedOut && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
            <p className="text-amber-400 mb-2">{t.pollTimeout}</p>
            <a
              href={`${chain?.blockExplorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              {t.checkOnExplorer}
            </a>
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
          isMobile ? (
            <button
              onClick={() => openConnectModal?.()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-colors text-sm sm:text-base"
            >
              {t.openInWallet}
            </button>
          ) : (
            <div className="flex justify-center">
              <ConnectButton label={t.connectToPayBtn} />
            </div>
          )
        ) : (
          <button
            onClick={handlePay}
            disabled={!effectiveAmount || isPending || isConfirming || isInsufficient || selfPayment}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-gray-500 text-white font-semibold rounded-2xl transition-colors text-sm sm:text-base"
          >
            {isConfirming
              ? t.waitingConfirm
              : isPending
              ? t.waitingWallet
              : t.payBtn(effectiveAmount || '?', data.token)}
          </button>
        )}

        {/* Secured by Base badge */}
        <p className="text-xs text-gray-400 text-center mt-4">
          🔒 Secured by Base — funds sent directly to recipient
        </p>
        </>
        )}
      </main>
    </div>
  )
}
