import { describe, expect, it } from 'vitest'
import { isGone } from '../src/freshness'

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

