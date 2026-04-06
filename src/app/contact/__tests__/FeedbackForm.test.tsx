// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FeedbackForm from '../FeedbackForm'

afterEach(() => vi.restoreAllMocks())

function fillValidForm() {
  fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
    target: { value: 'Test User' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
    target: { value: 'test@example.com' },
  })
  fireEvent.change(screen.getByRole('combobox', { name: /category/i }), {
    target: { value: 'Bug Report' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
    target: { value: 'This is a test message that is long enough.' },
  })
}

describe('FeedbackForm', () => {
  it('renders all fields and submit button', () => {
    render(<FeedbackForm />)

    expect(screen.getByRole('textbox', { name: /name/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /email/i })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /category/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /message/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeTruthy()
  })

  it('shows inline error on blur for empty required name field', () => {
    render(<FeedbackForm />)

    const nameInput = screen.getByRole('textbox', { name: /name/i })
    fireEvent.blur(nameInput)

    expect(screen.getByText('This field is required')).toBeTruthy()
  })

  it('disables submit button and shows spinner while submitting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    render(<FeedbackForm />)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /send feedback/i })
      expect(button).toBeDisabled()
    })

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('shows success message on 201 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 201 }))

    render(<FeedbackForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Thank you! Your feedback has been received.'),
      ).toBeTruthy()
    })
  })

  it('shows rate-limit message on 429 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 429 }))

    render(<FeedbackForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => {
      expect(
        screen.getByText("You've sent too many messages. Please try again later."),
      ).toBeTruthy()
    })
  })

  it('shows network error message when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    render(<FeedbackForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Network error. Please check your connection and try again.'),
      ).toBeTruthy()
    })
  })
})
