// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { translations } from '@/lib/i18n'

/**
 * Unit tests for QRDisplay share buttons (LINE, WhatsApp, Telegram)
 *
 * Validates: Requirements 1.1, 1.2, 6.1, 6.2, 6.3
 */

vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <div data-testid="qr-svg" />,
}))

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en' as const,
    t: translations.en,
    toggleLang: () => {},
  }),
}))

import { QRDisplay } from '../QRDisplay'

const TEST_URL = 'https://payo.app/pay/test123'
const SHARE_LABELS = ['Share via LINE', 'Share via WhatsApp', 'Share via Telegram'] as const

describe('QRDisplay — share buttons', () => {
  it('renders 3 share buttons when URL is provided', () => {
    render(<QRDisplay url={TEST_URL} />)

    for (const label of SHARE_LABELS) {
      expect(screen.getByLabelText(label)).toBeDefined()
    }
  })

  it('sets aria-disabled="true" and no href when disableCopy=true', () => {
    render(<QRDisplay url={TEST_URL} disableCopy={true} />)

    for (const label of SHARE_LABELS) {
      const btn = screen.getByLabelText(label)
      expect(btn.getAttribute('aria-disabled')).toBe('true')
      expect(btn.hasAttribute('href')).toBe(false)
    }
  })

  it('sets correct href values when disableCopy=false', () => {
    render(<QRDisplay url={TEST_URL} disableCopy={false} />)

    const lineBtn = screen.getByLabelText('Share via LINE')
    const whatsappBtn = screen.getByLabelText('Share via WhatsApp')
    const telegramBtn = screen.getByLabelText('Share via Telegram')

    const shareMsg = translations.en.shareMessage(TEST_URL)

    expect(lineBtn.getAttribute('href')).toBe(
      `https://line.me/R/share?text=${encodeURIComponent(shareMsg)}`
    )
    expect(whatsappBtn.getAttribute('href')).toBe(
      `https://wa.me/?text=${encodeURIComponent(shareMsg)}`
    )
    expect(telegramBtn.getAttribute('href')).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(TEST_URL)}&text=${encodeURIComponent(translations.en.shareMessageText)}`
    )
  })

  it('sets target="_blank" and rel="noopener noreferrer" when enabled', () => {
    render(<QRDisplay url={TEST_URL} disableCopy={false} />)

    for (const label of SHARE_LABELS) {
      const btn = screen.getByLabelText(label)
      expect(btn.getAttribute('target')).toBe('_blank')
      expect(btn.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })
})
