import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FeedbackSubmissionSchema } from '../route'

/**
 * Feature: contact-feedback-page, Property 2: Message field accepts valid lengths and rejects invalid lengths
 *
 * For any string, FeedbackSubmissionSchema message validator accepts it iff
 * its trimmed length is between 10 and 2000 characters (inclusive).
 *
 * **Validates: Requirements 2.4**
 */

const baseRecord = {
  name: 'Test User',
  email: 'test@example.com',
  category: 'General Feedback' as const,
}

describe('Feature: contact-feedback-page, Property 2: Message field accepts valid lengths and rejects invalid lengths', () => {
  it('accepts any message whose trimmed length is 10–2000 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }).filter(s => s.trim().length >= 10 && s.trim().length <= 2000),
        (message) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, message })
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects any message whose trimmed length is fewer than 10 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 9 }).filter(s => s.trim().length < 10),
        (message) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, message })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects any message whose trimmed length exceeds 2000 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2001, maxLength: 2100 }).filter(s => s.trim().length > 2000),
        (message) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, message })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
