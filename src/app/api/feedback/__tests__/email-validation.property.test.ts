import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FeedbackSubmissionSchema } from '../route'

/**
 * Feature: contact-feedback-page, Property 3: Email validator rejects non-email strings
 *
 * For any string that does not conform to a valid email format,
 * the FeedbackSubmissionSchema email validator SHALL reject it.
 *
 * **Validates: Requirements 2.2, 3.2**
 */

const baseRecord = {
  name: 'Test User',
  category: 'General Feedback' as const,
  message: 'This is a valid message with enough chars.',
}

describe('Feature: contact-feedback-page, Property 3: Email validator rejects non-email strings', () => {
  it('rejects any string that does not contain an @ character', () => {
    fc.assert(
      fc.property(
        // Strings without @ cannot be valid emails
        fc.string({ minLength: 0, maxLength: 100 }).filter(s => !s.includes('@')),
        (email) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, email })
          expect(result.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts well-formed email addresses (local@domain.tld pattern)', () => {
    // Use a constrained generator that produces emails Zod v4 accepts:
    // simple alphanumeric local part + domain with at least one dot
    const simpleEmailArb = fc.tuple(
      fc.stringMatching(/^[a-z][a-z0-9]{0,19}$/),
      fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/),
      fc.stringMatching(/^[a-z]{2,6}$/),
    ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

    fc.assert(
      fc.property(
        simpleEmailArb,
        (email) => {
          const result = FeedbackSubmissionSchema.safeParse({ ...baseRecord, email })
          expect(result.success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
