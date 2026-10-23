/**
 * Contract configuration for CryptoPayLink.
 * Provides the deployed contract address and ABI for interacting with the
 * feeless transfer contract via viem/wagmi.
 */

import { getContractAddress } from './contractRegistry'

export { getContractAddress } from './contractRegistry'

/** Deployed CryptoPayLink contract address (backward compat — default chain 84532) */
export const CRYPTO_PAY_LINK_ADDRESS = getContractAddress(84532);

/** ABI for the CryptoPayLink smart contract */
export const CryptoPayLinkABI = [
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
    type: "event",
    name: "NativePayment",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
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
      { name: "amount", type: "uint256", indexed: false },
      { name: "memo", type: "string", indexed: false },
    ],
  },
] as const;
