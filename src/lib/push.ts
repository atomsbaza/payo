// src/lib/push.ts — Web Push (VAPID) dispatch + iOS APNs stub
import webpush from 'web-push'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { pushSubscriptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'

let _vapidConfigured = false

function ensureVapid() {
  if (_vapidConfigured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL ?? 'mailto:admin@payo.app'
  if (!pub || !priv) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set')
  }
  webpush.setVapidDetails(email, pub, priv)
  _vapidConfigured = true
}

/**
 * Send a Web Push notification to all browser subscriptions for an owner.
 * Fire-and-forget: never throws.
 */
export async function dispatchWebPush(
  ownerAddress: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!isDatabaseConfigured()) return

  try {
    ensureVapid()
  } catch {
    // VAPID not configured — skip silently
    return
  }

  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[]
  try {
    subs = await getDb()
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.ownerAddress, ownerAddress))
  } catch {
    return
  }

  const payload = JSON.stringify({ title, body, data })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired → remove it
        if (
          err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          await getDb()
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id))
            .catch(() => {})
        }
      }
    }),
  )
}

/**
 * Main dispatch — sends Web Push to browser subscribers.
 * iOS APNs is handled separately by the mobile app via /api/notifications/register.
 */
export async function dispatchPush(
  ownerAddress: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await dispatchWebPush(ownerAddress, title, body, data)
}
