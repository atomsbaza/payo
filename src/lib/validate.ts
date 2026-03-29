import { z } from 'zod'
import { getChain } from './chainRegistry'
import { getToken } from './tokenRegistry'

/** Ethereum address format: 0x followed by 40 hex characters */
export const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/** Username: 3-30 chars, starts with a letter, lowercase alphanumeric + hyphens */
export const UsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z][a-z0-9-]*$/, 'Must start with a letter, only lowercase alphanumeric and hyphens')

/**
 * Validate that a chain ID is a positive integer (> 0).
 * Mirrors the database CHECK constraint on payment_links.chain_id.
 */
export function validateChainId(chainId: number): { valid: true } | { valid: false; reason: string } {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return { valid: false, reason: 'chain_id must be a positive integer (> 0)' }
  }
  return { valid: true }
}

export const PaymentLinkSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.string(),
  amount: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 1_000_000),
    { message: 'Amount must be empty or between 0 and 1,000,000' }
  ),
  memo: z.string().default(''),
  chainId: z.number().refine(id => !!getChain(id), { message: 'Unsupported chain' }),
  expiresAt: z.number().optional(),
  signature: z.string().optional(),
}).superRefine((data, ctx) => {
  if (getChain(data.chainId) && !getToken(data.chainId, data.token)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['token'],
      message: 'Token not supported on this chain',
    })
  }
})

export type ValidatedPaymentLink = z.infer<typeof PaymentLinkSchema>

export function validatePaymentLink(
  data: unknown
): { valid: true; data: ValidatedPaymentLink } | { valid: false; reason: string } {
  const result = PaymentLinkSchema.safeParse(data)
  if (!result.success) {
    return { valid: false, reason: result.error.issues[0]?.message ?? 'Invalid data' }
  }
  return { valid: true, data: result.data }
}

/** Subset of payment_links fields exposed by the Profile API */
export type PublicLink = {
  linkId: string
  token: string
  amount: string | null
  memo: string | null
  chainId: number
  expiresAt: string | null  // ISO string
}

export const CreateLinkRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.string(),
  amount: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0),
    { message: 'Amount must be empty or greater than 0' }
  ).default(''),
  memo: z.string().default(''),
  chainId: z.number().default(84532),
  expiresAt: z.number().optional(),
  singleUse: z.boolean().default(false),
})
