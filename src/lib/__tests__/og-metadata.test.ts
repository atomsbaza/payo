import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateOgMetadata } from '../og-metadata'

describe('generateOgMetadata', () => {
  it('returns fallback metadata when data is null', () => {
    const result = generateOgMetadata({ data: null, url: 'https://payo.cash' })
    expect(result.title).toBe('Crypto Pay Link')
    expect(result.openGraph?.url).toBe('https://payo.cash')
  })

  it('includes amount and token in title when amount is set', () => {
    const result = generateOgMetadata({
      data: { address: '0x1234567890123456789012345678901234567890', token: 'ETH', amount: '1.5', memo: '' },
      url: 'https://payo.cash/pay/abc',
    })
    expect(String(result.title)).toContain('1.5')
    expect(String(result.title)).toContain('ETH')
  })

  it('omits amount from title when amount is not set', () => {
    const result = generateOgMetadata({
      data: { address: '0x1234567890123456789012345678901234567890', token: 'USDC', amount: '', memo: '' },
      url: 'https://payo.cash/pay/abc',
    })
    expect(String(result.title)).not.toContain('undefined')
    expect(String(result.title)).toContain('USDC')
  })

  it('includes memo in description when present', () => {
    const result = generateOgMetadata({
      data: { address: '0x1234567890123456789012345678901234567890', token: 'ETH', amount: '1', memo: 'Lunch money' },
      url: 'https://payo.cash/pay/abc',
    })
    expect(String(result.description)).toContain('Lunch money')
  })

  it('always sets twitter card to summary_large_image', () => {
    const result = generateOgMetadata({ data: null, url: 'https://payo.cash' })
    expect(result.twitter?.card).toBe('summary_large_image')
  })

  it('property: openGraph url always matches input url', () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        const result = generateOgMetadata({ data: null, url })
        expect(result.openGraph?.url).toBe(url)
      })
    )
  })

  it('property: title and description are always strings when data is null', () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        const result = generateOgMetadata({ data: null, url })
        expect(typeof result.title).toBe('string')
        expect(typeof result.description).toBe('string')
      })
    )
  })
})
