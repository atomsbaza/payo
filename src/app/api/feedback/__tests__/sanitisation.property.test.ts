import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FeedbackSubmissionSchema } from '../route'

/**
 * Feature: contact-feedback-page, Property 10: Sanitisation strips angle brackets from name and message
 *
 * For any name or message string containing < or > characters,
 * the sanitised output from FeedbackSubmissionSchema SHALL not contain any < or > characters.
 *
 * **Validates: Requirements 8.2**
 */

const baseRecord = {
  email: 'test@example.com',
  category: 'General Feedback' as const,
}

// Generate a string that contains at least one < or > and has valid trimmed length
function withAngleBrackets(minLen: number, maxLen: number) {
  return fc.tuple(
    fc.string({ minLength: 1, maxLength: maxLen - 1 }),
    fc.constantFrom('<', '>'),
    fc.string({ minLength: 0, maxLength: maxLen - 2 }),
  ).map(([a, bracket, b]) => a + bracket + b)
    .filter(s => s.trim().length >= minLen && s.trim().length <= maxLen)
}

describe('Feature: contact-feedback-page, Property 10: Sanitisation strips angle brackets from name and message', () => {
  it('strips < and > from name field', () => {
    fc.assert(
      fc.property(
        withAngleBrackets(1, 100),
        (name) => {
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name,
            message: 'This is a valid message with enough chars.',
          })
          if (result.success) {
            expect(result.data.name).not.toContain('<')
            expect(result.data.name).not.toContain('>')
          }
          // If it fails validation for other reasons (e.g. trimmed to empty after stripping), that's fine
        },
      ),
      { numRuns: 100 },
    )
  })

  it('strips < and > from message field', () => {
    fc.assert(
      fc.property(
        withAngleBrackets(10, 2000),
        (message) => {
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name: 'Test User',
            message,
          })
          if (result.success) {
            expect(result.data.message).not.toContain('<')
            expect(result.data.message).not.toContain('>')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('name with only angle brackets and valid length has them stripped', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('<', '>', 'a', 'b', 'c'), { minLength: 1, maxLength: 100 })
          .map(chars => chars.join(''))
          .filter(s => s.trim().length >= 1 && s.trim().length <= 100),
        (name) => {
          const result = FeedbackSubmissionSchema.safeParse({
            ...baseRecord,
            name,
            message: 'This is a valid message with enough chars.',
          })
          if (result.success) {
            expect(result.data.name).not.toContain('<')
            expect(result.data.name).not.toContain('>')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
