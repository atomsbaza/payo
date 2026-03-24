import { neon } from '@neondatabase/serverless'
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

/**
 * Check whether a DATABASE_URL is configured.
 * When false the app falls back to in-memory / URL-based behaviour.
 */
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

// Lazy singleton — created on first access when DATABASE_URL is set.
let _db: NeonHttpDatabase<typeof schema> | null = null

function createDb(): NeonHttpDatabase<typeof schema> {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql, { schema })
}

/**
 * Drizzle database instance.
 * Throws if accessed when DATABASE_URL is not configured —
 * callers should guard with `isDatabaseConfigured()` first.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    if (!isDatabaseConfigured()) {
      throw new Error(
        'DATABASE_URL is not configured. Check isDatabaseConfigured() before calling getDb().',
      )
    }
    _db = createDb()
  }
  return _db
}

/** Convenience alias — same lazy singleton as getDb(). */
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})
