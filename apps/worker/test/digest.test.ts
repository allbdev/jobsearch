import { describe, expect, it } from 'vitest'
import { digestDue } from '../src/digest'

const base = {
  cadence: 'weekly' as const,
  sendOn: 'monday',
  sendAt: '08:00',
  timezone: 'America/Sao_Paulo',
  lastSentAt: null,
}

/** A moment in São Paulo, written as the UTC instant it is (BRT is UTC-3). */
const saoPaulo = (iso: string) => new Date(`${iso}-03:00`)

describe('when a digest is due', () => {
  it('waits for the send time in the reader’s own timezone, not the server’s', () => {
    // 07:00 in São Paulo is 10:00 UTC: a server reading UTC would send early.
    expect(digestDue({ ...base, now: saoPaulo('2026-09-21T07:00:00') }).due).toBe(false)
    expect(digestDue({ ...base, now: saoPaulo('2026-09-21T08:00:00') }).due).toBe(true)
  })

  it('weekly goes only on its own weekday', () => {
    // 2026-09-21 is a Monday; the 22nd is a Tuesday.
    expect(digestDue({ ...base, now: saoPaulo('2026-09-22T09:00:00') }).due).toBe(false)
    expect(digestDue({ ...base, sendOn: 'tuesday', now: saoPaulo('2026-09-22T09:00:00') }).due).toBe(true)
  })

  it('does not send twice in one day, or twice in one week', () => {
    const monday = saoPaulo('2026-09-21T09:00:00')
    expect(digestDue({ ...base, lastSentAt: saoPaulo('2026-09-21T08:05:00'), now: monday }).due).toBe(false)

    const daily = { ...base, cadence: 'daily' as const }
    expect(digestDue({ ...daily, lastSentAt: saoPaulo('2026-09-21T08:05:00'), now: monday }).due).toBe(false)
    // Yesterday's send does not block today's.
    expect(digestDue({ ...daily, lastSentAt: saoPaulo('2026-09-20T08:05:00'), now: monday }).due).toBe(true)
  })

  it('opens next week once six days have passed', () => {
    const lastMonday = saoPaulo('2026-09-14T08:00:00')
    expect(digestDue({ ...base, lastSentAt: lastMonday, now: saoPaulo('2026-09-21T08:00:00') }).due).toBe(true)
  })

  it('never sends when the digest is off', () => {
    expect(digestDue({ ...base, cadence: 'off', now: saoPaulo('2026-09-21T09:00:00') }).due).toBe(false)
  })

  it('covers since the last digest, or one period for a first one', () => {
    const now = saoPaulo('2026-09-21T09:00:00')
    const first = digestDue({ ...base, now })
    expect(Math.round((now.getTime() - first.periodStart.getTime()) / 86_400_000)).toBe(7)

    const daily = digestDue({ ...base, cadence: 'daily', now })
    expect(Math.round((now.getTime() - daily.periodStart.getTime()) / 86_400_000)).toBe(1)

    const lastSentAt = saoPaulo('2026-09-14T08:00:00')
    expect(digestDue({ ...base, lastSentAt, now }).periodStart).toEqual(lastSentAt)
  })

  it('reads the clock of a reader on the other side of the world', () => {
    const tokyo = { ...base, timezone: 'Asia/Tokyo', sendOn: 'monday', sendAt: '08:00' }
    // 2026-09-20T23:00 UTC is Monday 08:00 in Tokyo.
    expect(digestDue({ ...tokyo, now: new Date('2026-09-20T23:00:00Z') }).due).toBe(true)
    // …and still Sunday in São Paulo.
    expect(digestDue({ ...base, now: new Date('2026-09-20T23:00:00Z') }).due).toBe(false)
  })
})
