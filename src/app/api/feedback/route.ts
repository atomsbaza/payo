import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, isDatabaseConfigured } from '@/lib/db'
import { feedback } from '@/lib/schema'
import { createRateLimiter } from '@/lib/rate-limit'

// 2.1 — Validation schema
export const CATEGORIES = ['Bug Report', 'Feature Request', 'General Feedback', 'Other'] as const

export const FeedbackSubmissionSchema = z.object({
  name:     z.string().trim().min(1).max(100).transform(s => s.replace(/[<>]/g, '')),
  email:    z.string().trim().email().max(254),
  category: z.enum(CATEGORIES),
  message:  z.string().trim().min(10).max(2000).transform(s => s.replace(/[<>]/g, '')),
})

// 2.2 — IP extraction helper
export function extractIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'unknown'
}

// 2.3 — Rate limiter singleton: 3 requests per 60 minutes
const rateLimiter = createRateLimiter(3, 60 * 60 * 1000)

// 2.4 — POST handler
export async function POST(req: NextRequest) {
  // Extract IP and check rate limit
  const ip = extractIp(req)
  const { allowed, retryAfter } = rateLimiter.check(ip)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429 },
    )
  }

  // Validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ errors: [{ message: 'Invalid JSON' }] }, { status: 400 })
  }

  const result = FeedbackSubmissionSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ errors: result.error.issues }, { status: 400 })
  }

  // Guard DB
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  // SHA-256 hash the IP using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  const ipHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // INSERT into feedback table
  try {
    const db = getDb()
    await db.insert(feedback).values({
      name:     result.data.name,
      email:    result.data.email,
      category: result.data.category,
      message:  result.data.message,
      ipHash,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
