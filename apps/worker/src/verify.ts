import { prisma } from '@jobsearch/db'
import { isGone, staleBefore } from '@jobsearch/core'
import { createLinkChecker, type LinkChecker } from '@jobsearch/sources'
import { log } from './log'

export interface VerifyResult {
  /** Expired on age alone, without a request. */
  expiredByAge: number
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
 * Two mechanisms, because they fail in different directions. Age expiry is
 * free, certain and catches the common case -- a posting nobody re-listed in
 * two months is filled. Link checking is slow and noisy but catches the
 * posting pulled after a week.
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
    expiredByAge: 0, checked: 0, ok: 0, gone: 0, inconclusive: 0, unreachable: 0,
  }

  result.expiredByAge = await expireByAge()

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
 * Expire on age alone, in one statement.
 *
 * `postedAt` rather than when we first saw it: a posting we crawled yesterday
 * that opened in January is already stale, and dating expiry from discovery
 * would keep it for two more months.
 */
async function expireByAge(): Promise<number> {
  const { count } = await prisma.job.updateMany({
    where: { expiresAt: null, postedAt: { lt: staleBefore() } },
    data: { expiresAt: new Date() },
  })
  return count
}
