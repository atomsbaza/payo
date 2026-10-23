/**
 * ReceiptData type and helpers for transfer receipt generation.
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
  tokenDecimals: number
}

/**
 * Input shape accepted by buildReceiptData.
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
