import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FeedbackSubmissionSchema } from '../route'

/**
 * Feature: contact-feedback-page, Property 11: Whitespace trimming applies before length validation
 *
 * For any string with leading or trailing whitespace, the validator SHALL evaluate
 * length constraints against the trimmed value, not the raw value.
 *
 * **Validates: Requirements 8.1**
 */

const baseRecord = {
  email: 'test@example.com',
  category: 'General Feedback' as const,
}

// Pad a string with leading/trailing spaces
const withPadding = (core: fc.Arbitrary<string>) =>
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^\s]/g, ' ')),
    core,
    fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^\s]/g, ' ')),
  ).map(([pre, mid, post]) => pre + mid + post)

describe('Feature: contact-feedback-page, Property 11: Whitespace trimming applies before length validation', () => {
  it('accepts a name that is valid after trimming even with surrounding whitespace', () => {
    fc.assert(
      fc.property(
        withPadding(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1 && s.trim().length <= 100)),
        (name) => {
          fc.pre(name.trim().length >= 1 && name.trim().length <= 100)
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name,
            message: 'This is a valid message with enough chars.',
          })
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects a name that is whitespace-only (trimmed length 0) even if raw length > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }).map(n => ' '.repeat(n)),
        (name) => {
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name,
            message: 'This is a valid message with enough chars.',
          })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts a message that is valid after trimming even with surrounding whitespace', () => {
    fc.assert(
      fc.property(
        withPadding(fc.string({ minLength: 10, maxLength: 1990 }).filter(s => s.trim().length >= 10 && s.trim().length <= 1990)),
        (message) => {
          fc.pre(message.trim().length >= 10 && message.trim().length <= 2000)
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name: 'Test User',
            message,
          })
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects a message that is whitespace-only (trimmed length 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }).map(n => ' '.repeat(n)),
        (message) => {
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name: 'Test User',
            message,
          })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
