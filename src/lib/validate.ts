import { z } from 'zod'

export const PaymentLinkSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.enum(['ETH', 'USDC'], { message: 'Unsupported token' }),
  amount: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 1_000_000),
    { message: 'Amount must be empty or between 0 and 1,000,000' }
  ),
  memo: z.string().default(''),
  chainId: z.literal(84532, { message: 'Invalid chain' }),
  expiresAt: z.number().optional(),
  signature: z.string().optional(),
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

export const CreateLinkRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.enum(['ETH', 'USDC'], { message: 'Unsupported token' }),
  amount: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0),
    { message: 'Amount must be empty or greater than 0' }
  ).default(''),
  memo: z.string().default(''),
  chainId: z.number().default(84532),
  expiresAt: z.number().optional(),
})
