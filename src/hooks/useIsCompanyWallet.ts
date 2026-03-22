'use client'

import { useAccount } from 'wagmi'
import { COMPANY_WALLET } from '@/lib/contract'

/**
 * Pure function: case-insensitive comparison of two wallet addresses.
 * Returns false if either address is undefined or companyWallet is empty.
 * Exported separately for unit / property-based testing.
 *
 * Requirements: 4.1, 4.2
 */
export function isCompanyWallet(
  connectedAddress: string | undefined,
  companyWallet: string | undefined
): boolean {
  if (!companyWallet) return false
  if (!connectedAddress) return false
  return connectedAddress.toLowerCase() === companyWallet.toLowerCase()
}

/**
 * Hook that checks whether the currently connected wallet matches
 * the configured COMPANY_WALLET environment variable.
 *
 * @returns { isCompany: boolean, isConnected: boolean }
 */
export function useIsCompanyWallet(): {
  isCompany: boolean
  isConnected: boolean
} {
  const { address, isConnected } = useAccount()
  const isCompany = isCompanyWallet(address, COMPANY_WALLET)
  return { isCompany, isConnected }
}
