// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QrLinkModal } from '../QrLinkModal'

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} />,
}))

const mockLink = {
  url: 'https://payo.cash/pay/abc123',
  token: 'ETH',
  amount: '1.5',
  address: '0x1234567890123456789012345678901234567890',
  memo: 'Lunch',
  createdAt: Date.now(),
}

describe('QrLinkModal', () => {
  it('renders QR code with link url', () => {
    render(<QrLinkModal link={mockLink} onClose={() => {}} />)
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe(mockLink.url)
  })

  it('shows amount and token', () => {
    render(<QrLinkModal link={mockLink} onClose={() => {}} />)
    expect(screen.getByText('1.5 ETH')).toBeTruthy()
  })

  it('shows memo when present', () => {
    render(<QrLinkModal link={mockLink} onClose={() => {}} />)
    // memo is rendered with HTML entities &ldquo; &rdquo; — use container query
    const { container } = render(<QrLinkModal link={mockLink} onClose={() => {}} />)
    expect(container.textContent).toContain('Lunch')
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<QrLinkModal link={mockLink} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<QrLinkModal link={mockLink} onClose={onClose} />)
    const backdrop = container.querySelector('[role="dialog"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(<QrLinkModal link={mockLink} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows token only when no amount', () => {
    render(<QrLinkModal link={{ ...mockLink, amount: '' }} onClose={() => {}} />)
    expect(screen.getByText('ETH')).toBeTruthy()
  })

  it('has role=dialog and aria-modal', () => {
    render(<QrLinkModal link={mockLink} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })
})
