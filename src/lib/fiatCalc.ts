/**
 * Pure function for calculating fiat equivalent of a crypto amount.
 * Requirements: 2.3
 */
export function calculateFiatValue(
  cryptoAmount: string,
  pricePerUnit: number
): string | null {
  const amount = parseFloat(cryptoAmount)
  if (isNaN(amount) || amount <= 0 || pricePerUnit <= 0) return null
  return (amount * pricePerUnit).toFixed(2)
}
