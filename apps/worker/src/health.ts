import { prisma } from '@jobsearch/db'

export interface SourceHealth {
  slug: string
  enabled: boolean
  failureStreak: number
  lastPolledAt: Date | null
  lastError: string | null
  rawPostings: number
  /** Minutes since the last successful poll, or null if never polled. */
  staleMinutes: number | null
  /** How overdue it is against its own pollIntervalMinutes. */
  overdue: boolean
  status: 'ok' | 'stale' | 'failing' | 'never-run' | 'disabled'
}

/**
 * Why this exists.
 *
 * `failureStreak` and `lastError` were being recorded faithfully and read by
 * nobody. A source that quietly stops returning results is how an index rots
 * without anyone noticing (PLAN.md §7) — and the only symptom would be a job
 * count that stops growing, which is exactly the kind of silence that does not
 * announce itself.
 *
 * Recording a signal is not the same as watching it.
 */
export async function sourceHealth(): Promise<SourceHealth[]> {
  const sources = await prisma.source.findMany({
    orderBy: { slug: 'asc' },
    include: { _count: { select: { rawPostings: true } } },
  })

  const now = Date.now()

  return sources.map((source) => {
    const staleMinutes = source.lastPolledAt
      ? Math.round((now - source.lastPolledAt.getTime()) / 60_000)
      : null
    // Two intervals of grace: one missed run is a blip, two is a pattern.
    const overdue = staleMinutes !== null && staleMinutes > source.pollIntervalMinutes * 2

    const status: SourceHealth['status'] = !source.enabled
      ? 'disabled'
      : source.failureStreak > 0
        ? 'failing'
        : staleMinutes === null
          ? 'never-run'
          : overdue
            ? 'stale'
            : 'ok'

    return {
      slug: source.slug,
      enabled: source.enabled,
      failureStreak: source.failureStreak,
      lastPolledAt: source.lastPolledAt,
      lastError: source.lastError,
      rawPostings: source._count.rawPostings,
      staleMinutes,
      overdue,
      status,
    }
  })
}

const SYMBOL: Record<SourceHealth['status'], string> = {
  ok: '✓',
  stale: '⚠',
  failing: '✗',
  'never-run': '·',
  disabled: '–',
}

export function formatHealth(rows: SourceHealth[]): string {
  if (rows.length === 0) return 'No sources configured. Seed one: pnpm worker seed'

  const lines = rows.map((row) => {
    const age = row.staleMinutes === null ? 'never' : `${row.staleMinutes}m ago`
    const head = `${SYMBOL[row.status]} ${row.slug.padEnd(14)} ${row.status.padEnd(10)} ${String(row.rawPostings).padStart(6)} postings   polled ${age}`
    // The error is the actionable part, so it is not truncated away.
    return row.lastError ? `${head}\n    last error: ${row.lastError}` : head
  })

  return lines.join('\n')
}

/** True when something needs attention — the exit code a scheduler can act on. */
export function isUnhealthy(rows: SourceHealth[]): boolean {
  return rows.some((row) => row.status === 'failing' || row.status === 'stale')
}
