/**
 * ReceiptData type and helpers for payment receipt generation.
 * All fee values are stored as strings (BigInt serialization) for JSON compatibility.
 */

export type ReceiptData = {
  payerAddress: string
  recipientAddress: string
  tokenSymbol: string
  tokenName: string
  amount: string
  chainName: string
  chainId: number
  txHash: string
  blockExplorerUrl: string
  memo: string
  confirmedAt: number          // unix timestamp ms
  feeTotal: string             // BigInt as string (wei)
  feeAmount: string            // BigInt as string (wei)
  feeNet: string               // BigInt as string (wei)
  feeRateBps: string           // BigInt as string (basis points)
  tokenDecimals: number
}

/**
 * Input shape accepted by buildReceiptData.
 * Optional fields get sensible defaults (empty string / "0").
 */
export type BuildReceiptDataInput = {
  payerAddress: string
  recipientAddress: string
  tokenSymbol: string
  tokenName: string
  amount: string
  chainName: string
  chainId: number
  txHash: string
  blockExplorerUrl: string
  memo?: string
  confirmedAt: number
  feeTotal?: string
  feeAmount?: string
  feeNet?: string
  feeRateBps?: string
  tokenDecimals: number
}

/** Build a ReceiptData object with defaults for optional fields. */
export function buildReceiptData(input: BuildReceiptDataInput): ReceiptData {
  return {
    payerAddress: input.payerAddress,
    recipientAddress: input.recipientAddress,
    tokenSymbol: input.tokenSymbol,
    tokenName: input.tokenName,
    amount: input.amount,
    chainName: input.chainName,
    chainId: input.chainId,
    txHash: input.txHash,
    blockExplorerUrl: input.blockExplorerUrl,
    memo: input.memo ?? '',
    confirmedAt: input.confirmedAt,
    feeTotal: input.feeTotal ?? '0',
    feeAmount: input.feeAmount ?? '0',
    feeNet: input.feeNet ?? '0',
    feeRateBps: input.feeRateBps ?? '0',
    tokenDecimals: input.tokenDecimals,
  }
}

/** Serialize ReceiptData to a JSON string. */
export function serializeReceiptData(data: ReceiptData): string {
  return JSON.stringify(data)
}

/** Deserialize a JSON string back to ReceiptData. */
export function deserializeReceiptData(json: string): ReceiptData {
  return JSON.parse(json) as ReceiptData
}

/** Generate a receipt PDF filename from a transaction hash. */
export function receiptFilename(txHash: string): string {
  return `payo-receipt-${txHash.slice(2, 10)}.pdf`
}
