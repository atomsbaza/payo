/**
 * Contract Registry — map chain ID → deployed CryptoPayLinkFee address.
 * อ่านจาก env vars: NEXT_PUBLIC_CONTRACT_ADDRESS_{CHAIN_ID}
 * Fallback: NEXT_PUBLIC_CONTRACT_ADDRESS สำหรับ chain 84532
 */

const DEFAULT_CHAIN_ID = 84532

export function getContractAddress(chainId: number): `0x${string}` | undefined {
  // ลอง per-chain env var ก่อน
  const perChain = process.env[`NEXT_PUBLIC_CONTRACT_ADDRESS_${chainId}`]
  if (perChain) return perChain as `0x${string}`

  // Fallback: ตัวเดิมสำหรับ default chain เท่านั้น
  if (chainId === DEFAULT_CHAIN_ID) {
    const legacy = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    if (legacy) return legacy as `0x${string}`
  }

  return undefined
}
