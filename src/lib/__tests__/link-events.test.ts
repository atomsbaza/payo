import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hashIp, truncateUserAgent } from '../link-events'

// Mock db and isDatabaseConfigured
vi.mock('../db', () => ({
  isDatabaseConfigured: vi.fn(() => true),
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}))

import { isDatabaseConfigured, db } from '../db'
import { logLinkEvent } from '../link-events'

/** Helper to create a mock values fn and wire it to db.insert */
function setupInsertMock() {
  const valuesFn = vi.fn(() => Promise.resolve())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.insert).mockReturnValue({ values: valuesFn } as unknown as ReturnType<typeof db.insert>)
  return valuesFn
}

/** Extract the first argument of the first call to a mock fn */
function firstCallArg(fn: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return (fn.mock.calls as unknown[][])[0][0] as Record<string, unknown>
}

describe('link-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
  })

  describe('hashIp', () => {
    it('returns a 64-character lowercase hex string', () => {
      const result = hashIp('192.168.1.1')
      expect(result).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces consistent hashes for the same input', () => {
      expect(hashIp('10.0.0.1')).toBe(hashIp('10.0.0.1'))
    })

    it('produces different hashes for different inputs', () => {
      expect(hashIp('10.0.0.1')).not.toBe(hashIp('10.0.0.2'))
    })
  })

  describe('truncateUserAgent', () => {
    it('returns the string unchanged when ≤ 512 chars', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      expect(truncateUserAgent(ua)).toBe(ua)
    })

    it('truncates to exactly 512 characters when longer', () => {
      const ua = 'A'.repeat(600)
      expect(truncateUserAgent(ua)).toHaveLength(512)
    })

    it('handles empty string', () => {
      expect(truncateUserAgent('')).toBe('')
    })

    it('handles exactly 512 characters', () => {
      const ua = 'B'.repeat(512)
      expect(truncateUserAgent(ua)).toBe(ua)
      expect(truncateUserAgent(ua)).toHaveLength(512)
    })
  })

  describe('logLinkEvent', () => {
    it('skips insert when database is not configured', async () => {
      vi.mocked(isDatabaseConfigured).mockReturnValue(false)

      await logLinkEvent({
        linkId: 'test-link',
        eventType: 'viewed',
      })

      expect(db.insert).not.toHaveBeenCalled()
    })

    it('calls db.insert with correct values for a viewed event', async () => {
      const valuesFn = setupInsertMock()

      await logLinkEvent({
        linkId: 'link-123',
        eventType: 'viewed',
        ipHash: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })

      expect(db.insert).toHaveBeenCalled()
      expect(valuesFn).toHaveBeenCalledWith({
        linkId: 'link-123',
        eventType: 'viewed',
        payerAddress: null,
        txHash: null,
        ipHash: hashIp('192.168.1.1'),
        userAgent: 'Mozilla/5.0',
      })
    })

    it('hashes the IP address via ipHash param', async () => {
      const valuesFn = setupInsertMock()

      await logLinkEvent({
        linkId: 'link-456',
        eventType: 'viewed',
        ipHash: '10.0.0.1',
      })

      const callArgs = firstCallArg(valuesFn)
      // Should be a SHA-256 hex, not the raw IP
      expect(callArgs.ipHash).toMatch(/^[0-9a-f]{64}$/)
      expect(callArgs.ipHash).not.toBe('10.0.0.1')
    })

    it('truncates user agent to 512 characters', async () => {
      const valuesFn = setupInsertMock()

      const longUa = 'X'.repeat(1000)
      await logLinkEvent({
        linkId: 'link-789',
        eventType: 'viewed',
        userAgent: longUa,
      })

      const callArgs = firstCallArg(valuesFn)
      expect(callArgs.userAgent).toHaveLength(512)
    })

    it('passes payerAddress and txHash for paid events', async () => {
      const valuesFn = setupInsertMock()

      await logLinkEvent({
        linkId: 'link-paid',
        eventType: 'paid',
        payerAddress: '0xabc123',
        txHash: '0xtx456',
      })

      const callArgs = firstCallArg(valuesFn)
      expect(callArgs.eventType).toBe('paid')
      expect(callArgs.payerAddress).toBe('0xabc123')
      expect(callArgs.txHash).toBe('0xtx456')
    })

    it('does not throw when db insert fails (fire-and-forget)', async () => {
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('DB connection failed')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Should not throw
      await expect(
        logLinkEvent({ linkId: 'link-err', eventType: 'viewed' })
      ).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[link-events] Failed to log event:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('sets optional fields to null when not provided', async () => {
      const valuesFn = setupInsertMock()

      await logLinkEvent({
        linkId: 'link-minimal',
        eventType: 'tamper_blocked',
      })

      const callArgs = firstCallArg(valuesFn)
      expect(callArgs.payerAddress).toBeNull()
      expect(callArgs.txHash).toBeNull()
      expect(callArgs.ipHash).toBeNull()
      expect(callArgs.userAgent).toBeNull()
    })
  })
})
