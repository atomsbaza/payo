type RateLimitEntry = {
  count: number
  resetAt: number
}

export function createRateLimiter(limit: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>()

  return {
    check(key: string): { allowed: boolean; retryAfter: number } {
      const now = Date.now()

      // Clean up expired entries
      for (const [k, entry] of store) {
        if (now >= entry.resetAt) {
          store.delete(k)
        }
      }

      const entry = store.get(key)

      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfter: 0 }
      }

      if (entry.count >= limit) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return { allowed: false, retryAfter }
      }

      entry.count++
      return { allowed: true, retryAfter: 0 }
    },
  }
}
