/**
 * Contract configuration for CryptoPayLinkFee.
 * Provides the deployed contract address, company wallet, default fee rate,
 * and the ABI for interacting with the contract via viem/wagmi.
 */

import { getContractAddress } from './contractRegistry'

export { getContractAddress } from './contractRegistry'

/** Deployed CryptoPayLinkFee contract address (backward compat — default chain 84532) */
export const CRYPTO_PAY_LINK_ADDRESS = getContractAddress(84532);

/** Company wallet that receives fee portions of every payment */
export const COMPANY_WALLET = process.env
  .NEXT_PUBLIC_COMPANY_WALLET as `0x${string}`;

/** Default fee rate in basis points (1% = 100bp), used as fallback */
export const DEFAULT_FEE_RATE = 100n;

/** ABI for the CryptoPayLinkFee smart contract */
export const CryptoPayLinkFeeABI = [
  {
    type: "function",
    name: "payNative",
    stateMutability: "payable",
    inputs: [
      { name: "payee", type: "address" },
      { name: "memo", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "feeRate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "companyWallet",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setFeeRate",
    stateMutability: "nonpayable",
    inputs: [{ name: "_feeRate", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setCompanyWallet",
    stateMutability: "nonpayable",
    inputs: [{ name: "_companyWallet", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "NativePayment",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "feeAmount", type: "uint256", indexed: false },
      { name: "netAmount", type: "uint256", indexed: false },
      { name: "memo", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokenPayment",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "feeAmount", type: "uint256", indexed: false },
      { name: "netAmount", type: "uint256", indexed: false },
      { name: "memo", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeeRateUpdated",
    inputs: [
      { name: "oldRate", type: "uint256", indexed: false },
      { name: "newRate", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CompanyWalletUpdated",
    inputs: [
      { name: "oldWallet", type: "address", indexed: false },
      { name: "newWallet", type: "address", indexed: false },
    ],
  },
] as const;
