import { createHash } from 'crypto'
import { db } from './db'
import { isDatabaseConfigured } from './db'
import { linkEvents } from './schema'

export type LinkEventType = 'viewed' | 'paid' | 'expired' | 'tamper_blocked'

const MAX_USER_AGENT_LENGTH = 512

/**
 * Hash an IP address with SHA-256 for privacy.
 * Returns a 64-character lowercase hex string.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

/**
 * Truncate user agent string to at most 512 characters.
 */
export function truncateUserAgent(ua: string): string {
  return ua.length > MAX_USER_AGENT_LENGTH
    ? ua.slice(0, MAX_USER_AGENT_LENGTH)
    : ua
}

/**
 * Log a link event to the `link_events` table.
 *
 * Uses fire-and-forget pattern — if the insert fails, the error is
 * logged to console but never thrown, so it won't block the response.
 */
export async function logLinkEvent(params: {
  linkId: string
  eventType: LinkEventType
  payerAddress?: string
  txHash?: string
  ipHash?: string
  userAgent?: string
}): Promise<void> {
  if (!isDatabaseConfigured()) return

  try {
    await db.insert(linkEvents).values({
      linkId: params.linkId,
      eventType: params.eventType,
      payerAddress: params.payerAddress ?? null,
      txHash: params.txHash ?? null,
      ipHash: params.ipHash ? hashIp(params.ipHash) : null,
      userAgent: params.userAgent
        ? truncateUserAgent(params.userAgent)
        : null,
    })
  } catch (error) {
    console.error('[link-events] Failed to log event:', error)
  }
}
