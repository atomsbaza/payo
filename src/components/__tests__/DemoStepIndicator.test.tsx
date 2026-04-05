// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/context/LangContext', () => ({
  useLang: () => ({ lang: 'en', t: {}, toggleLang: () => {} }),
}))

import { DemoStepIndicator } from '../DemoStepIndicator'

describe('DemoStepIndicator', () => {
  it('renders all 3 step labels in English', () => {
    render(<DemoStepIndicator currentStep={1} />)
    expect(screen.getByText('Create QR')).toBeTruthy()
    expect(screen.getByText('Pay')).toBeTruthy()
    expect(screen.getByText('Success')).toBeTruthy()
  })

  it('shows current step number highlighted', () => {
    const { container } = render(<DemoStepIndicator currentStep={2} />)
    const circles = container.querySelectorAll('.bg-indigo-600')
    expect(circles.length).toBe(1)
    expect(circles[0].textContent).toBe('2')
  })

  it('shows checkmark for completed steps', () => {
    const { container } = render(<DemoStepIndicator currentStep={3} />)
    // only step circles (rounded-full) that are completed
    const completed = container.querySelectorAll('.bg-green-600.rounded-full')
    expect(completed.length).toBe(2)
    completed.forEach(el => expect(el.textContent).toBe('✓'))
  })

  it('shows step number for future steps', () => {
    const { container } = render(<DemoStepIndicator currentStep={1} />)
    const future = container.querySelectorAll('.bg-zinc-700.rounded-full')
    expect(future.length).toBe(2)
  })
})
