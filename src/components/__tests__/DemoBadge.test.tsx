// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoBadge } from '../DemoBadge'

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({
    lang: 'en',
    t: { demoBanner: 'Demo Mode — no real transactions' },
    toggleLang: () => {},
  }),
}))

describe('DemoBadge', () => {
  it('renders demo banner text', () => {
    render(<DemoBadge />)
    expect(screen.getByText('Demo Mode — no real transactions')).toBeTruthy()
  })

  it('has amber styling', () => {
    const { container } = render(<DemoBadge />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('amber')
  })
})
