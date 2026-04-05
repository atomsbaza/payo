'use client'

import { useState, useEffect, useCallback } from 'react'

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

/**
 * Convert a base64url VAPID public key to a Uint8Array for PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}

/**
 * Hook to manage Web Push notification subscription for a wallet address.
 *
 * Usage:
 *   const { state, subscribe, unsubscribe } = usePushNotification(address)
 */
export function usePushNotification(ownerAddress: string | undefined) {
  const [state, setState] = useState<PushState>('loading')

  // Check current subscription state on mount
  useEffect(() => {
    if (!ownerAddress) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    }).catch(() => setState('unsubscribed'))
  }, [ownerAddress])

  const subscribe = useCallback(async () => {
    if (!ownerAddress) return
    setState('loading')

    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Fetch VAPID public key
      const res = await fetch('/api/push/vapid-public-key')
      if (!res.ok) throw new Error('Push not configured on server')
      const { publicKey } = await res.json() as { publicKey: string }

      // Request permission + subscribe
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      // Save subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: ownerAddress, endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      })

      setState('subscribed')
    } catch (err) {
      console.error('[usePushNotification] subscribe error:', err)
      setState('unsubscribed')
    }
  }, [ownerAddress])

  const unsubscribe = useCallback(async () => {
    if (!ownerAddress) return
    setState('loading')

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { endpoint, keys } = sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string; auth: string }
        }
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: ownerAddress, endpoint, p256dh: keys.p256dh, auth: keys.auth }),
        })
      }
      setState('unsubscribed')
    } catch (err) {
      console.error('[usePushNotification] unsubscribe error:', err)
      setState('subscribed')
    }
  }, [ownerAddress])

  return { state, subscribe, unsubscribe }
}
