import { z } from 'zod'

const SavedLinkSchema = z.object({
  url: z.string(),
  address: z.string(),
  token: z.string(),
  amount: z.string(),
  memo: z.string(),
  createdAt: z.number(),
  expiryDate: z.number().optional(),
})

export type SavedLink = z.infer<typeof SavedLinkSchema>

/**
 * อ่านและ validate myLinks จาก localStorage
 * กรอง item ที่ไม่ถูกต้องออก แล้วบันทึกกลับ
 */
export function getValidatedLinks(): SavedLink[] {
  try {
    const raw = localStorage.getItem('myLinks')
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      localStorage.setItem('myLinks', '[]')
      return []
    }

    const validItems = parsed.filter(
      (item: unknown) => SavedLinkSchema.safeParse(item).success
    )

    if (validItems.length !== parsed.length) {
      localStorage.setItem('myLinks', JSON.stringify(validItems))
    }

    return validItems
  } catch {
    localStorage.setItem('myLinks', '[]')
    return []
  }
}
