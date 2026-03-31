import { jsPDF } from 'jspdf'
import type { ReceiptData } from '@/lib/receiptData'
import { translations } from '@/lib/i18n'

/**
 * Convert a wei-denominated string to a human-readable decimal string.
 * e.g. formatWei("1000000", 6) → "1.000000"
 */
export function formatWei(wei: string, decimals: number): string {
  if (decimals === 0) return wei

  const isNegative = wei.startsWith('-')
  const abs = isNegative ? wei.slice(1) : wei
  const padded = abs.padStart(decimals + 1, '0')
  const intPart = padded.slice(0, padded.length - decimals)
  const fracPart = padded.slice(padded.length - decimals)

  const result = `${intPart}.${fracPart}`
  return isNegative ? `-${result}` : result
}

/**
 * Generate a payment receipt PDF from ReceiptData.
 * Pure function: returns a jsPDF instance ready for output/save.
 */
export async function generateReceiptPdf(
  data: ReceiptData,
  locale: 'th' | 'en',
): Promise<jsPDF> {
  const t = translations[locale]
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginLeft = 20
  const marginRight = 20
  const contentWidth = pageWidth - marginLeft - marginRight
  const indigo: [number, number, number] = [99, 102, 241] // #6366f1

  let y = 25

  // ── Header: Payo brand name ──
  doc.setFontSize(28)
  doc.setTextColor(...indigo)
  doc.setFont('helvetica', 'bold')
  doc.text('Payo', marginLeft, y)
  y += 12

  // ── Title ──
  doc.setFontSize(18)
  doc.setTextColor(...indigo)
  doc.text(t.receiptTitle, marginLeft, y)
  y += 4

  // Accent line
  doc.setDrawColor(...indigo)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, y, marginLeft + contentWidth, y)
  y += 12

  // ── Helper to render a label-value row ──
  const labelColor: [number, number, number] = [107, 114, 128] // gray-500
  const valueColor: [number, number, number] = [17, 24, 39]    // gray-900

  function drawRow(label: string, value: string): number {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...labelColor)
    doc.text(label, marginLeft, y)
    y += 5

    doc.setFontSize(11)
    doc.setTextColor(...valueColor)
    doc.setFont('helvetica', 'normal')
    // Handle long values (addresses, hashes) by splitting
    const lines = doc.splitTextToSize(value, contentWidth) as string[]
    doc.text(lines, marginLeft, y)
    y += lines.length * 5 + 4
    return y
  }

  // ── Receipt fields ──

  // Payer address
  drawRow(t.receiptPayer, data.payerAddress)

  // Recipient address
  drawRow(t.receiptRecipient, data.recipientAddress)

  // Token
  drawRow(t.receiptToken, `${data.tokenName} (${data.tokenSymbol})`)

  // Amount
  drawRow(t.receiptAmount, `${data.amount} ${data.tokenSymbol}`)

  // Chain
  drawRow(t.receiptChain, data.chainName)

  // TX Hash — rendered as clickable link
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...labelColor)
  doc.text(t.receiptTxHash, marginLeft, y)
  y += 5

  doc.setFontSize(11)
  doc.setTextColor(...indigo)
  doc.setFont('helvetica', 'normal')
  const txLines = doc.splitTextToSize(data.txHash, contentWidth) as string[]
  doc.text(txLines, marginLeft, y)

  // Add link annotation covering the TX hash text area
  const txLinkUrl = `${data.blockExplorerUrl}/tx/${data.txHash}`
  const txTextHeight = txLines.length * 5
  doc.link(marginLeft, y - 4, contentWidth, txTextHeight + 2, { url: txLinkUrl })
  y += txTextHeight + 4

  // Memo (only when non-empty)
  if (data.memo && data.memo.length > 0) {
    drawRow(t.receiptMemo, data.memo)
  }

  // Confirmed timestamp
  const confirmedDate = new Date(data.confirmedAt)
  const localeTag = locale === 'th' ? 'th-TH' : 'en-US'
  const formattedDate = confirmedDate.toLocaleString(localeTag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  drawRow(t.receiptConfirmedAt, formattedDate)

  // ── Fee breakdown (only when fee > 0) ──
  const feeAmount = BigInt(data.feeAmount)
  if (feeAmount > 0n) {
    y += 2
    doc.setFontSize(13)
    doc.setTextColor(...indigo)
    doc.setFont('helvetica', 'bold')
    const feeHeading = locale === 'th' ? 'รายละเอียดค่าธรรมเนียม' : 'Fee Breakdown'
    doc.text(feeHeading, marginLeft, y)
    y += 2
    doc.setDrawColor(...indigo)
    doc.setLineWidth(0.3)
    doc.line(marginLeft, y, marginLeft + contentWidth, y)
    y += 7

    doc.setFont('helvetica', 'normal')

    const totalFormatted = formatWei(data.feeTotal, data.tokenDecimals)
    drawRow(t.receiptFeeTotal, `${totalFormatted} ${data.tokenSymbol}`)

    const feeFormatted = formatWei(data.feeAmount, data.tokenDecimals)
    drawRow(t.receiptFeeAmount, `${feeFormatted} ${data.tokenSymbol}`)

    const feeRatePercent = Number(BigInt(data.feeRateBps)) / 100
    drawRow(t.receiptFeeRate, `${feeRatePercent}%`)

    const netFormatted = formatWei(data.feeNet, data.tokenDecimals)
    drawRow(t.receiptFeeNet, `${netFormatted} ${data.tokenSymbol}`)
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 15
  doc.setDrawColor(209, 213, 219) // gray-300
  doc.setLineWidth(0.3)
  doc.line(marginLeft, footerY - 5, marginLeft + contentWidth, footerY - 5)

  doc.setFontSize(9)
  doc.setTextColor(...labelColor)
  doc.setFont('helvetica', 'normal')
  doc.text(t.receiptFooter, marginLeft, footerY)

  const now = new Date()
  const genTimestamp = now.toLocaleString(localeTag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  doc.text(genTimestamp, pageWidth - marginRight, footerY, { align: 'right' })

  return doc
}
