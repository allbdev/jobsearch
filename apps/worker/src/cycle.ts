import { prisma } from '@jobsearch/db'
import { backfillCountries } from './backfill-countries'
import { classifyJobs } from './classify'
import { fetchSource } from './fetch-source'
import { assignJobFamilies } from './job-families'
import { log } from './log'
import { normalizePostings } from './normalize'
import { verifyJobs } from './verify'

export interface CycleResult {
  sources: { fetched: string[]; skipped: string[]; failed: string[] }
  normalized: number
  classified: number
  verified: number
  expired: number
}

/**
 * The whole free pipeline, in the one order it can run in: fetch, normalize,
 * classify, verify.
 *
 * A scheduler needs one entry point, not five commands and the knowledge of
 * which follows which. Getting the order wrong is silent -- classify before
 * normalize simply finds nothing to do -- so it lives here rather than in a
 * cron line someone edits later.
 *
 * **The paid pass is not part of it.** `classify --llm` stays a separate,
 * deliberate command: a cycle that quietly spends money every hour is how a
 * crawl becomes a bill (COSTS.md). Postings the rules cannot settle wait as
 * `needs_check`, which is an honest state, until someone runs the LLM pass.
 */
/**
 * Link checks per cycle. Verify walks least-recently-checked first and only
 * touches what is over a week old, so a cap is a pace, not a backlog: the rest
 * are picked up next run. Uncapped it checked 3,018 links in one go and took 13
 * of the run's 14 minutes, which is not something to repeat hourly.
 */
const VERIFY_PER_CYCLE = 300

export async function runCycle(
  options: { force?: boolean; verifyLimit?: number; now?: Date } = {},
): Promise<CycleResult> {
  const now = options.now ?? new Date()
  const result: CycleResult = {
    sources: { fetched: [], skipped: [], failed: [] },
    normalized: 0,
    classified: 0,
    verified: 0,
    expired: 0,
  }

  const sources = await prisma.source.findMany({ where: { enabled: true }, orderBy: { slug: 'asc' } })
  for (const source of sources) {
    // Each source carries its own interval; polling a board more often than it
    // changes is how a crawler gets blocked (PLAN.md §3).
    const due =
      options.force ||
      !source.lastPolledAt ||
      source.lastPolledAt.getTime() + source.pollIntervalMinutes * 60_000 <= now.getTime()
    if (!due) {
      result.sources.skipped.push(source.slug)
      continue
    }

    try {
      const fetched = await fetchSource(source.slug)
      result.sources.fetched.push(source.slug)
      log('cycle fetched', { source: source.slug, ...fetched })
    } catch (error) {
      // One board being down is not a reason to skip the rest, or to leave the
      // postings already fetched unprocessed. `fetchSource` records the failure
      // streak, and `worker health` is what reports it.
      result.sources.failed.push(source.slug)
      log('cycle fetch failed', { source: source.slug, error: String(error) })
    }
  }

  const normalized = await normalizePostings({})
  result.normalized = normalized.created + normalized.updated
  log('cycle normalized', { ...normalized })

  const classified = await classifyJobs({})
  result.classified = classified.considered
  log('cycle classified', { ...classified })

  // Free and derived, exactly as in `classify`.
  log('cycle families assigned', { ...(await assignJobFamilies()) })
  log('cycle countries derived', { ...(await backfillCountries()) })

  // Last: a job that has just disappeared from its board should not be verified
  // as live in the same run that stopped seeing it.
  const verified = await verifyJobs({ limit: options.verifyLimit ?? VERIFY_PER_CYCLE })
  result.verified = verified.checked
  result.expired = verified.disappeared + verified.gone
  log('cycle verified', { ...verified })

  return result
}
