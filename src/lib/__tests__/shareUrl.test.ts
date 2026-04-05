import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  buildLineShareUrl,
  buildWhatsAppShareUrl,
  buildTelegramShareUrl,
  buildShareMessage,
} from '../shareUrl'

describe('shareUrl', () => {
  it('buildLineShareUrl encodes message into LINE share URL', () => {
    const url = buildLineShareUrl('Pay me 1 ETH')
    expect(url).toMatch(/^https:\/\/line\.me\/R\/share\?text=/)
    expect(url).toContain(encodeURIComponent('Pay me 1 ETH'))
  })

  it('buildWhatsAppShareUrl encodes message into WhatsApp share URL', () => {
    const url = buildWhatsAppShareUrl('Pay me 1 ETH')
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(url).toContain(encodeURIComponent('Pay me 1 ETH'))
  })

  it('buildTelegramShareUrl encodes url and text', () => {
    const result = buildTelegramShareUrl('https://payo.cash/pay/abc', 'Pay me')
    expect(result).toMatch(/^https:\/\/t\.me\/share\/url\?/)
    expect(result).toContain(encodeURIComponent('https://payo.cash/pay/abc'))
    expect(result).toContain(encodeURIComponent('Pay me'))
  })

  it('buildShareMessage uses translation function', () => {
    const t = { shareMessage: (url: string) => `Please pay: ${url}` }
    expect(buildShareMessage(t, 'https://payo.cash/pay/abc')).toBe('Please pay: https://payo.cash/pay/abc')
  })

  it('property: LINE URL always starts with line.me domain', () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const url = buildLineShareUrl(msg)
        expect(url.startsWith('https://line.me/R/share?text=')).toBe(true)
      })
    )
  })

  it('property: WhatsApp URL always starts with wa.me domain', () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const url = buildWhatsAppShareUrl(msg)
        expect(url.startsWith('https://wa.me/?text=')).toBe(true)
      })
    )
  })

  it('property: Telegram URL contains both encoded url and text params', () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.string(), (payUrl, text) => {
        const result = buildTelegramShareUrl(payUrl, text)
        expect(result).toContain('t.me/share/url')
        expect(result).toContain(encodeURIComponent(payUrl))
      })
    )
  })
})
