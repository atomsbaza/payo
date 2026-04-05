// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Skeleton from '../Skeleton'

describe('Skeleton', () => {
  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('w-32')
  })

  it('renders without className prop', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeTruthy()
  })
})
