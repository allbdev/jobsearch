const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * Compact relative time ("2d ago"). Takes `now` explicitly so server and
 * client render the same string — a bare `Date.now()` here is a hydration
 * mismatch waiting to happen.
 */
export function relativeTime(iso: string, now: number): string {
  const delta = now - new Date(iso).getTime()
  if (delta < HOUR) return `${Math.max(1, Math.round(delta / MINUTE))}m ago`
  if (delta < DAY) return `${Math.round(delta / HOUR)}h ago`
  if (delta < WEEK) return `${Math.round(delta / DAY)}d ago`
  const weeks = Math.round(delta / WEEK)
  return weeks === 1 ? '1w ago' : `${weeks}w ago`
}

/** "today" / "yesterday" / "3d ago" for link-verification stamps. */
export function verifiedLabel(iso: string | null, now: number): string {
  if (!iso) return 'not verified'
  const delta = now - new Date(iso).getTime()
  if (delta < DAY) return 'today'
  if (delta < 2 * DAY) return 'yesterday'
  return relativeTime(iso, now)
}
