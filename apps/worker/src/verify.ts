import { prisma } from '@jobsearch/db'
import { isGone } from '@jobsearch/core'
import { createLinkChecker, type LinkChecker } from '@jobsearch/sources'
import { log } from './log'

export interface VerifyResult {
  /** Expired because their source stopped listing them, without a request. */
  disappeared: number
  checked: number
  ok: number
  /** Answered 404 or 410 — the posting is gone, so it leaves the feeds. */
  gone: number
  /** Answered, but not with a verdict we act on: bot walls, rate limits, outages. */
  inconclusive: number
  /** Never answered at all. */
  unreachable: number
}

const CONCURRENCY = 6

/**
 * Stage 4 of the pipeline (PLAN.md §4): keep the index honest about what is
 * still open.
 *
 * A job leaves the feeds when it stops being available to apply to, and never
 * merely because it has been open a while. Two mechanisms, because they see
 * different things: a source dropping a posting is free to detect and covers
 * every job it lists, while a link check catches the posting whose board still
 * advertises it after the employer has closed it.
 *
 * Neither deletes anything. `expiresAt` drops a job out of feeds while leaving
 * the row, its evidence and its provenance intact, because a job that comes
 * back should not have to be re-classified from scratch.
 */
export async function verifyJobs(
  options: { limit?: number; staleAfterHours?: number; checker?: LinkChecker } = {},
): Promise<VerifyResult> {
  const { limit, staleAfterHours = 24 * 7 } = options
  const result: VerifyResult = {
    disappeared: 0, checked: 0, ok: 0, gone: 0, inconclusive: 0, unreachable: 0,
  }

  result.disappeared = await expireDisappeared()

  const staleBefore = new Date(Date.now() - staleAfterHours * 60 * 60 * 1000)
  const jobs = await prisma.job.findMany({
    where: {
      expiresAt: null,
      OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: staleBefore } }],
    },
    // Never-checked first, then longest-unchecked. A run that is cut short by
    // `--limit` should still make progress on the oldest information.
    orderBy: [{ lastVerifiedAt: { sort: 'asc', nulls: 'first' } }, { postedAt: 'desc' }],
    ...(limit ? { take: limit } : {}),
    select: { id: true, applyUrl: true },
  })

  const checker = options.checker ?? createLinkChecker()
  const queue = [...jobs]

  const work = async (): Promise<void> => {
    for (;;) {
      const job = queue.shift()
      if (!job) return

      const status = await checker.status(job.applyUrl)
      result.checked++

      const gone = isGone(status)
      await prisma.job.update({
        where: { id: job.id },
        data: {
          lastVerifiedAt: new Date(),
          httpStatus: status,
          ...(gone ? { expiresAt: new Date() } : {}),
        },
      })

      if (gone) result.gone++
      else if (status === 0) result.unreachable++
      else if (status >= 200 && status < 300) result.ok++
      else result.inconclusive++
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, work))

  if (result.checked > 0 && result.ok === 0) {
    // Every single check failing is not 3,000 dead jobs, it is one broken
    // assumption -- no network, a blocked user agent, a bad build. Saying so
    // is the difference between a bug and a silently emptied index.
    log('every link check failed — treating the run as suspect, not the jobs', {
      checked: result.checked,
    })
  }

  return result
}

/**
 * Expire the jobs whose sources have stopped listing them.
 *
 * A crawl records `fetchedAt` on every posting it sees, changed or not, so a
 * posting still on the board carries this run's timestamp and one that vanished
 * keeps an older one. That is evidence, where age was only a guess.
 *
 * Two guards, because the failure mode is emptying the index:
 *
 * A source mid-failure is skipped entirely. `failureStreak` is non-zero exactly
 * when the last crawl did not complete, and a board that 500s for an afternoon
 * has not closed all its jobs.
 *
 * A job is expired only when *every* posting of it has gone stale. Jobs are
 * deduped across boards and sources, so one board dropping a listing that
 * another still carries means the job is still open.
 */
async function expireDisappeared(): Promise<number> {
  const sources = await prisma.source.findMany({
    where: { failureStreak: 0, lastPolledAt: { not: null } },
    select: { id: true, slug: true, lastPolledAt: true },
  })
  if (sources.length === 0) return 0

  // A crawl takes time, so a posting seen early in one is stamped earlier than
  // the run that finished. The window has to be wider than the longest crawl.
  const GRACE_HOURS = 12

  const staleJobIds = new Set<string>()
  for (const source of sources) {
    const cutoff = new Date(source.lastPolledAt!.getTime() - GRACE_HOURS * 60 * 60 * 1000)
    const stale = await prisma.rawPosting.findMany({
      where: { sourceId: source.id, jobId: { not: null }, fetchedAt: { lt: cutoff } },
      select: { jobId: true },
    })
    for (const row of stale) staleJobIds.add(row.jobId!)
  }
  if (staleJobIds.size === 0) return 0

  // Anything still listed anywhere keeps the job alive.
  const stillListed = await prisma.rawPosting.findMany({
    where: {
      jobId: { in: [...staleJobIds] },
      OR: sources.map((source) => ({
        sourceId: source.id,
        fetchedAt: { gte: new Date(source.lastPolledAt!.getTime() - GRACE_HOURS * 60 * 60 * 1000) },
      })),
    },
    select: { jobId: true },
  })
  for (const row of stillListed) staleJobIds.delete(row.jobId!)
  if (staleJobIds.size === 0) return 0

  const { count } = await prisma.job.updateMany({
    where: { id: { in: [...staleJobIds] }, expiresAt: null },
    data: { expiresAt: new Date() },
  })
  return count
}
