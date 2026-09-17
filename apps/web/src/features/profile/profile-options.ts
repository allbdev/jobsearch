import 'server-only'

import { INTERFACE_LANGUAGES, ISO_COUNTRY_CODES, WEEKDAYS, WORK_LANGUAGES } from '@jobsearch/shared'
import { localeMeta, type Locale } from '@/i18n/routing'

export interface Option {
  value: string
  label: string
}

/** Every picker on the profile screen, as codes with labels in the page's language. */
export interface ProfileOptions {
  countries: Option[]
  timeZones: Option[]
  workLanguages: Option[]
  emailLanguages: Option[]
  weekdays: Option[]
  hours: Option[]
}

/**
 * Built on the server and passed down, never in the browser: the time zones
 * `Intl` knows, and the names it gives them, differ between Node's ICU and a
 * browser's, and two renders of a `<select>` with different options is a
 * hydration mismatch.
 */
export function profileOptions(locale: Locale, now = new Date()): ProfileOptions {
  const intl = localeMeta[locale].intl
  const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label, intl)
  const regions = new Intl.DisplayNames(intl, { type: 'region' })
  const languages = new Intl.DisplayNames(intl, { type: 'language' })
  const weekday = new Intl.DateTimeFormat(intl, { weekday: 'long', timeZone: 'UTC' })

  return {
    countries: ISO_COUNTRY_CODES.map((code) => ({ value: code, label: regions.of(code) ?? code })).sort(byLabel),
    // `UTC` is valid everywhere but absent from `supportedValuesOf`, and it is
    // the zone a new profile starts in, so it is offered explicitly.
    timeZones: ['UTC', ...Intl.supportedValuesOf('timeZone')]
      .map((zone) => ({ zone, offset: offsetOf(zone, now) }))
      .sort((a, b) => a.offset.minutes - b.offset.minutes || a.zone.localeCompare(b.zone))
      .map(({ zone, offset }) => ({ value: zone, label: `(${offset.label}) ${zone.replaceAll('_', ' ')}` })),
    workLanguages: WORK_LANGUAGES.map((code) => ({ value: code, label: languages.of(code) ?? code })),
    emailLanguages: INTERFACE_LANGUAGES.map((code) => ({ value: code, label: localeMeta[code].label })),
    // 2024-01-01 was a Monday; WEEKDAYS starts on Monday.
    weekdays: WEEKDAYS.map((day, index) => ({ value: day, label: weekday.format(Date.UTC(2024, 0, 1 + index)) })),
    hours: Array.from({ length: 24 }, (_, hour) => {
      const value = `${String(hour).padStart(2, '0')}:00`
      return { value, label: value }
    }),
  }
}

/** "GMT-03:00" and -180 for America/Sao_Paulo, as of `now` (offsets move with daylight saving). */
function offsetOf(zone: string, now: Date): { label: string; minutes: number } {
  const label =
    new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label)
  const minutes = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0
  return { label: label === 'GMT' ? 'GMT+00:00' : label, minutes }
}
