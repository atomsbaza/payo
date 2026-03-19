/**
 * ตรวจสอบว่า connected wallet address ตรงกับ recipient address หรือไม่
 * เปรียบเทียบแบบ case-insensitive
 */
export function isSelfPayment(
  connectedAddress: string | undefined,
  recipientAddress: string
): boolean {
  if (!connectedAddress) return false
  return connectedAddress.toLowerCase() === recipientAddress.toLowerCase()
}
