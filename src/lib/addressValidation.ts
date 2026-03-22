import { isAddress, getAddress } from 'viem'

export type AddressValidationResult = {
  valid: boolean
  checksumValid: boolean
  normalized: string | null
}

export function validateEthAddress(input: string): AddressValidationResult {
  if (!input || !input.startsWith('0x')) {
    return { valid: false, checksumValid: false, normalized: null }
  }

  if (!isAddress(input, { strict: false })) {
    return { valid: false, checksumValid: false, normalized: null }
  }

  const normalized = getAddress(input)
  const hasUpperCase = /[A-F]/.test(input.slice(2))
  const checksumValid = !hasUpperCase || input === normalized

  return { valid: true, checksumValid, normalized }
}
