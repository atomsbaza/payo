// src/lib/push.ts — APNs push notification sender (JWT auth, HTTP/2)
//
// Required env vars:
//   APNS_KEY_ID      — 10-char key ID from developer.apple.com > Certificates > Keys
//   APNS_TEAM_ID     — 10-char team ID from developer.apple.com > Account
//   APNS_PRIVATE_KEY — full .p8 file contents (with -----BEGIN/END----- and newlines as \n)
//   APNS_BUNDLE_ID   — e.g. "com.example.QR-Payment-mobile-app"
//   APNS_SANDBOX     — "true" for development builds, omit/false for production

import crypto from 'crypto'
import http2 from 'http2'
import { isDatabaseConfigured, getDb } from '@/lib/db'
import { pushTokens } from '@/lib/schema'
import { eq } from 'drizzle-orm'

const APNS_HOST = process.env.APNS_SANDBOX === 'true'
  ? 'api.sandbox.push.apple.com'
  : 'api.push.apple.com'

// Cache the JWT for up to 55 minutes (APNs tokens expire after 60 min)
let cachedJwt: { token: string; issuedAt: number } | null = null

function makeAPNsJWT(): string {
  const now = Math.floor(Date.now() / 1000)

  if (cachedJwt && now - cachedJwt.issuedAt < 55 * 60) {
    return cachedJwt.token
  }

  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!keyId || !teamId || !privateKey) {
    throw new Error('Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY env vars')
  }

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString('base64url')
  const signingInput = `${header}.${payload}`

  const sign = crypto.createSign('SHA256')
  sign.update(signingInput)
  const signature = sign.sign(
    { key: privateKey, format: 'pem', dsaEncoding: 'ieee-p1363' },
    'base64url',
  )

  const token = `${signingInput}.${signature}`
  cachedJwt = { token, issuedAt: now }
  return token
}

/**
 * Send a single APNs push notification via HTTP/2.
 * Returns true on success (HTTP 200 from APNs).
 */
export async function sendAPNs(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const bundleId = process.env.APNS_BUNDLE_ID
  if (!bundleId) {
    console.warn('[push] APNS_BUNDLE_ID not set — skipping push')
    return false
  }

  let jwt: string
  try {
    jwt = makeAPNsJWT()
  } catch (err) {
    console.warn('[push] APNs JWT error:', err)
    return false
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: 'default',
      badge: 1,
    },
    ...data,
  })

  return new Promise((resolve) => {
    const client = http2.connect(`https://${APNS_HOST}`)

    client.on('error', (err) => {
      console.error('[push] http2 connect error:', err)
      resolve(false)
    })

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      ':scheme': 'https',
      ':authority': APNS_HOST,
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    })

    req.write(payload)
    req.end()

    let statusCode = 0
    req.on('response', (headers) => {
      statusCode = Number(headers[':status'] ?? 0)
    })

    req.on('end', () => {
      client.close()
      if (statusCode === 200) {
        resolve(true)
      } else {
        console.warn(`[push] APNs returned status ${statusCode} for token ${deviceToken.slice(0, 8)}…`)
        resolve(false)
      }
    })

    req.on('error', (err) => {
      console.error('[push] request error:', err)
      client.close()
      resolve(false)
    })

    // Safety timeout
    setTimeout(() => {
      client.close()
      resolve(false)
    }, 10_000)
  })
}

/**
 * Look up all push tokens for a wallet address and dispatch a notification.
 * Fire-and-forget — never throws.
 */
export async function dispatchPush(
  ownerAddress: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!isDatabaseConfigured()) return
  if (!process.env.APNS_KEY_ID) return  // silently skip if APNs not configured

  try {
    const db = getDb()
    const tokens = await db
      .select({ deviceToken: pushTokens.deviceToken })
      .from(pushTokens)
      .where(eq(pushTokens.ownerAddress, ownerAddress))

    await Promise.allSettled(
      tokens.map(({ deviceToken }) => sendAPNs(deviceToken, title, body, data)),
    )
  } catch (err) {
    console.error('[push] dispatchPush error:', err)
  }
}
