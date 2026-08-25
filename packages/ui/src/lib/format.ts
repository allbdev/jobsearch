import { formatLabel, type UiLabels } from '../i18n/labels'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** The label subset the time helpers need — so callers can pass the whole set. */
type TimeLabels = Pick<
  UiLabels,
  'minutesAgo' | 'hoursAgo' | 'daysAgo' | 'oneWeekAgo' | 'weeksAgo' | 'today' | 'yesterday' | 'notVerified'
>

/**
 * Compact relative time ("2d ago"). Takes `now` explicitly so server and
 * client render the same string — a bare `Date.now()` here is a hydration
 * mismatch waiting to happen.
 */
export function relativeTime(iso: string, now: number, labels: TimeLabels): string {
  const delta = now - new Date(iso).getTime()
  if (delta < HOUR) {
    return formatLabel(labels.minutesAgo, { count: Math.max(1, Math.round(delta / MINUTE)) })
  }
  if (delta < DAY) return formatLabel(labels.hoursAgo, { count: Math.round(delta / HOUR) })
  if (delta < WEEK) return formatLabel(labels.daysAgo, { count: Math.round(delta / DAY) })
  const weeks = Math.round(delta / WEEK)
  return weeks === 1 ? labels.oneWeekAgo : formatLabel(labels.weeksAgo, { count: weeks })
}

/** "today" / "yesterday" / "3d ago" for link-verification stamps. */
export function verifiedLabel(iso: string | null, now: number, labels: TimeLabels): string {
  if (!iso) return labels.notVerified
  const delta = now - new Date(iso).getTime()
  if (delta < DAY) return labels.today
  if (delta < 2 * DAY) return labels.yesterday
  return relativeTime(iso, now, labels)
}
