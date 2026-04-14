import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Bugfix: payment-to-transfer-rename, Property 1: Bug Condition
 * "payment" Identifiers Found in In-Scope Files
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 *
 * For each in-scope file, assert that it does NOT contain any known
 * "payment" identifiers. On UNFIXED code this test WILL FAIL — that
 * failure is the expected outcome and confirms the bug exists.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Root of the payo project (three levels up from src/__tests__)
const projectRoot = resolve(__dirname, '../../')

function readFile(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf-8')
}

describe('Bugfix: payment-to-transfer-rename, Property 1: Bug Condition — "payment" identifiers in in-scope files', () => {

  it('src/lib/schema.ts — no paymentLinks, no payment_links table string, no payment_links_link_id_unique', () => {
    const content = readFile('src/lib/schema.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('paymentLinks') &&
             !c.includes('payment_links') &&
             !c.includes('payment_links_link_id_unique')
    }))
  })

  it('src/lib/encode.ts — no PaymentLinkData, no encodePaymentLink, no decodePaymentLink, no DEMO_PAYMENT_DATA', () => {
    const content = readFile('src/lib/encode.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('PaymentLinkData') &&
             !c.includes('encodePaymentLink') &&
             !c.includes('decodePaymentLink') &&
             !c.includes('DEMO_PAYMENT_DATA')
    }))
  })

  it('src/lib/hmac.ts — no signPaymentLink, no verifyPaymentLink', () => {
    const content = readFile('src/lib/hmac.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('signPaymentLink') &&
             !c.includes('verifyPaymentLink')
    }))
  })

  it('src/lib/validate.ts — no PaymentLinkSchema, no ValidatedPaymentLink, no validatePaymentLink', () => {
    const content = readFile('src/lib/validate.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('PaymentLinkSchema') &&
             !c.includes('ValidatedPaymentLink') &&
             !c.includes('validatePaymentLink')
    }))
  })

  it('src/lib/webhookPayload.ts — no PaymentCompletedData, no buildPaymentCompletedPayload, no payment_completed', () => {
    const content = readFile('src/lib/webhookPayload.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('PaymentCompletedData') &&
             !c.includes('buildPaymentCompletedPayload') &&
             !c.includes('payment_completed')
    }))
  })

  it('src/app/api/links/[id]/route.ts — no decodePaymentLink, no DEMO_PAYMENT_DATA, no validatePaymentLink, no verifyPaymentLink, no buildPaymentCompletedPayload, no paymentLinks', () => {
    const content = readFile('src/app/api/links/[id]/route.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('decodePaymentLink') &&
             !c.includes('DEMO_PAYMENT_DATA') &&
             !c.includes('validatePaymentLink') &&
             !c.includes('verifyPaymentLink') &&
             !c.includes('buildPaymentCompletedPayload') &&
             !c.includes('paymentLinks')
    }))
  })

  it('src/app/api/dashboard/[address]/route.ts — no paymentLinks', () => {
    const content = readFile('src/app/api/dashboard/[address]/route.ts')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('paymentLinks')
    }))
  })

  it('drizzle/0000_left_johnny_blaze.sql — no payment_links, no payment_links_link_id_unique, no link_events_link_id_payment_links_link_id_fk', () => {
    const content = readFile('drizzle/0000_left_johnny_blaze.sql')
    fc.assert(fc.property(fc.constant(content), (c) => {
      return !c.includes('payment_links') &&
             !c.includes('payment_links_link_id_unique') &&
             !c.includes('link_events_link_id_payment_links_link_id_fk')
    }))
  })

  it('drizzle/meta/*.json snapshot files — no public.payment_links, no payment_links_link_id_unique', () => {
    const metaDir = resolve(projectRoot, 'drizzle/meta')
    const snapshotFiles = readdirSync(metaDir)
      .filter(f => f.endsWith('.json') && f !== '_journal.json')

    for (const filename of snapshotFiles) {
      const content = readFileSync(resolve(metaDir, filename), 'utf-8')
      fc.assert(fc.property(fc.constant(content), (c) => {
        return !c.includes('public.payment_links') &&
               !c.includes('payment_links_link_id_unique')
      }), { verbose: true })
    }
  })
})
