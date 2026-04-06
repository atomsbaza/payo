// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { createElement } from 'react'
import FeedbackForm from '../FeedbackForm'

/**
 * Feature: contact-feedback-page, Property 4: Live character counter is always (2000 − message.length)
 *
 * For any message string of length 0 to 2000, the character counter displayed
 * by FeedbackForm SHALL equal 2000 − message.length.
 *
 * **Validates: Requirements 3.5**
 */

describe('Feature: contact-feedback-page, Property 4: Live character counter is always (2000 − message.length)', () => {
  it('displays (2000 - message.length) characters remaining for any message length 0–2000', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 2000 }),
        (message) => {
          const { unmount } = render(createElement(FeedbackForm))

          const textarea = screen.getByRole('textbox', { name: /message/i })
          fireEvent.change(textarea, { target: { value: message } })

          const expected = 2000 - message.length
          const counter = screen.getByText(`${expected} characters remaining`)
          expect(counter).toBeTruthy()

          unmount()
        },
      ),
      { numRuns: 100 },
    )
  })
})
