import { describe, expect, it } from 'vitest'
import { EXPIRY_DAYS, expiryFromPostedAt, isGone, staleBefore } from '../src/freshness'

describe('expiryFromPostedAt', () => {
  it('expires a posting EXPIRY_DAYS after it opened, not after we saw it', () => {
    const posted = new Date('2026-01-01T00:00:00Z')
    const expiry = expiryFromPostedAt(posted)
    expect(expiry.toISOString()).toBe('2026-03-02T00:00:00.000Z')
    expect((expiry.getTime() - posted.getTime()) / 86400000).toBe(EXPIRY_DAYS)
  })
})

describe('isGone', () => {
  it.each([404, 410])('%d means the posting no longer exists', (status) => {
    expect(isGone(status)).toBe(true)
  })

  // Expiring on these would delete live jobs on the strength of someone else's
  // outage — or of us being mistaken for a scraper.
  it.each([200, 301, 302, 401, 403, 429, 500, 502, 503])(
    '%d does not mean the posting is gone',
    (status) => {
      expect(isGone(status)).toBe(false)
    },
  )
})

describe('staleBefore', () => {
  it('is EXPIRY_DAYS before now, and agrees with expiryFromPostedAt', () => {
    const now = new Date('2026-03-02T00:00:00Z')
    expect(staleBefore(now).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    // A posting made exactly at the cutoff expires exactly now.
    expect(expiryFromPostedAt(staleBefore(now)).getTime()).toBe(now.getTime())
  })
})
