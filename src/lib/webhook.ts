// src/lib/webhook.ts — Webhook signing, secret generation, and dispatch logic
import crypto from 'crypto'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { webhookRegistrations, webhookLogs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import type { WebhookPayload } from '@/lib/webhookPayload'

/**
 * Compute HMAC-SHA256 signature of a raw JSON body using the given secret.
 * Returns a 64-character lowercase hex string.
 */
export function signWebhookPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
}

/**
 * Generate a cryptographically random webhook secret (32 bytes → 64 hex chars).
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Send a single webhook HTTP POST with timeout.
 * Returns success/failure info including status code, error, and response time.
 */
export async function sendWebhookRequest(
  url: string,
  rawBody: string,
  signature: string,
  eventType: string,
  timeoutMs?: number,
): Promise<{ success: boolean; statusCode: number | null; error: string | null; responseTimeMs: number }> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payo-Signature': signature,
        'X-Payo-Event': eventType,
      },
      body: rawBody,
      signal: AbortSignal.timeout(timeoutMs ?? 10_000),
    })
    const responseTimeMs = Date.now() - start
    const success = res.status >= 200 && res.status < 300
    return {
      success,
      statusCode: res.status,
      error: success ? null : `HTTP ${res.status}`,
      responseTimeMs,
    }
  } catch (err) {
    const responseTimeMs = Date.now() - start
    return {
      success: false,
      statusCode: null,
      error: err instanceof Error ? err.message : String(err),
      responseTimeMs,
    }
  }
}


/**
 * Main dispatch function — look up webhook registration, send with retry, log result.
 * Fire-and-forget: never throws, catches all errors internally.
 */
export async function dispatchWebhook(
  ownerAddress: string,
  payload: WebhookPayload,
): Promise<void> {
  try {
    // Guard: skip if DB is not configured
    if (!isDatabaseConfigured()) {
      return
    }

    // Look up webhook registration for this owner
    const rows = await getDb()
      .select()
      .from(webhookRegistrations)
      .where(eq(webhookRegistrations.ownerAddress, ownerAddress))
      .limit(1)

    const registration = rows[0]
    if (!registration) {
      // No registration found — skip silently
      return
    }

    // Serialize and sign
    const rawBody = JSON.stringify(payload)
    const signature = signWebhookPayload(rawBody, registration.webhookSecret)

    // Send with retry: up to 2 retries (total 3 attempts), backoff 1s then 4s
    const backoffs = [1_000, 4_000]
    let result = await sendWebhookRequest(
      registration.webhookUrl,
      rawBody,
      signature,
      payload.event,
    )

    for (let i = 0; i < backoffs.length && !result.success; i++) {
      await new Promise((r) => setTimeout(r, backoffs[i]))
      result = await sendWebhookRequest(
        registration.webhookUrl,
        rawBody,
        signature,
        payload.event,
      )
    }

    // Log result to webhook_logs
    await getDb().insert(webhookLogs).values({
      ownerAddress,
      eventType: payload.event,
      payloadSummary: rawBody.slice(0, 500),
      httpStatus: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      success: result.success,
      errorMessage: result.error,
    })

    // Update lastTriggeredAt on the registration
    await getDb()
      .update(webhookRegistrations)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhookRegistrations.ownerAddress, ownerAddress))
  } catch (err) {
    // Never propagate errors — log and swallow
    console.error('[webhook] dispatchWebhook error:', err)
  }
}
