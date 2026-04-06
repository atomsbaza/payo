import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import { FeedbackSubmissionSchema } from '../route'

/**
 * Feature: contact-feedback-page, Property 1: Name field accepts valid lengths and rejects invalid lengths
 *
 * For any string, FeedbackSubmissionSchema name validator accepts it iff
 * its trimmed length is between 1 and 100 characters (inclusive).
 *
 * **Validates: Requirements 2.1**
 */

// Minimal valid record — only name is varied
const baseRecord = {
  email: 'test@example.com',
  category: 'General Feedback' as const,
  message: 'This is a valid message with enough chars.',
}

describe('Feature: contact-feedback-page, Property 1: Name field accepts valid lengths and rejects invalid lengths', () => {
  it('accepts any name whose trimmed length is 1–100 chars', () => {
    fc.assert(
      fc.property(
        // Generate a core string of 1–100 chars, optionally pad with whitespace
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1 && s.trim().length <= 100),
        (name) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, name })
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects any name whose trimmed length is 0 (empty or whitespace-only)', () => {
    fc.assert(
      fc.property(
        // Whitespace-only strings trim to length 0
        fc.string({ minLength: 0, maxLength: 50 }).map(s => s.replace(/[^\s]/g, ' ')),
        (name) => {
          fc.pre(name.trim().length === 0)
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, name })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects any name whose trimmed length exceeds 100 chars', () => {
    fc.assert(
      fc.property(
        // Generate strings that are >100 chars when trimmed
        fc.string({ minLength: 101, maxLength: 200 }).filter(s => s.trim().length > 100),
        (name) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, name })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
