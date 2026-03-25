type ShareTranslations = {
  shareMessage: (url: string) => string
}

/** สร้าง LINE share URL */
export function buildLineShareUrl(message: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(message)}`
}

/** สร้าง WhatsApp share URL */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/** สร้าง Telegram share URL */
export function buildTelegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

/** สร้างข้อความแชร์จาก i18n translations */
export function buildShareMessage(t: ShareTranslations, url: string): string {
  return t.shareMessage(url)
}
