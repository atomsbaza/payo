// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { createElement } from 'react'
import FeedbackForm from '../FeedbackForm'

/**
 * Feature: contact-feedback-page, Property 12: Non-201/non-429 error responses show generic error in UI
 *
 * For any HTTP status code that is neither 201 nor 429, the FeedbackForm SHALL
 * display the generic error message "Something went wrong. Please try again."
 *
 * **Validates: Requirements 7.3**
 */

afterEach(() => vi.restoreAllMocks())

async function fillAndSubmit() {
  await act(async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
  })
}

describe('Feature: contact-feedback-page, Property 12: Non-201/non-429 error responses show generic error in UI', () => {
  it('shows generic error for any non-201/non-429 status code', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }).filter(s => s !== 429),
        async (status) => {
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status }))

          const { unmount } = render(createElement(FeedbackForm))

          await fillAndSubmit()

          await waitFor(() => {
            expect(
              screen.getByText('Something went wrong. Please try again.'),
            ).toBeTruthy()
          })

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 100 },
    )
  }, 60_000)
})
