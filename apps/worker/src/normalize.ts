import { prisma, type Prisma } from '@jobsearch/db'
import { jobContentHash, mergeLocations, normalizeCompanyName } from '@jobsearch/core'
import { getAdapter } from '@jobsearch/sources'
import { log } from './log'

export interface NormalizeResult {
  considered: number
  created: number
  updated: number
  deduped: number
  /** Deduped postings that widened the job's location rather than repeating it. */
  locationsMerged: number
  skipped: number
}

export interface NormalizeOptions {
  /** Only this source. */
  slug?: string
  /**
   * Re-normalise postings that already produced a job.
   *
   * This is the replayability PLAN.md §4 promises, cashed in for the first
   * time: when the normaliser improves — as it just did, by keeping the
   * location it had been discarding — the fix has to reach the postings
   * already processed, and re-crawling to get there would defeat the point of
   * storing raw payloads at all.
   */
  reprocess?: boolean
}


/** How many raw postings to hold in memory at once. */
const BATCH = 200

/**
 * Stage 2 of the pipeline (PLAN.md §4): `raw_postings` → `jobs`.
 *
 * Replays from stored payloads, so improving this function is a re-run rather
 * than a re-crawl. It finds its work by `jobId IS NULL`, which is why the
 * relation is many-to-one.
 */
export async function normalizePostings(
  options: NormalizeOptions = {},
): Promise<NormalizeResult> {
  const { slug, reprocess = false } = options
  const result: NormalizeResult = { considered: 0, created: 0, updated: 0, deduped: 0, locationsMerged: 0, skipped: 0 }

  const where: Prisma.RawPostingWhereInput = {
    ...(reprocess ? {} : { jobId: null }),
    ...(slug ? { source: { slug } } : {}),
  }

  // Company lookups repeat heavily — one board is one company for hundreds of
  // postings — so the resolved ids are cached for the run.
  const companyCache = new Map<string, string>()

  // jobId -> every location its postings carry, in first-seen order. Settled
  // after the loop rather than per row: a job can have ten postings, and
  // writing each one's location as it arrives leaves whichever came last.
  const locationsByJob = new Map<string, string[]>()

  // Reprocessing walks every row, so it pages by cursor rather than by
  // "still unprocessed" — the filter it would otherwise page on is exactly what
  // reprocessing stops changing.
  let cursor: string | undefined

  for (;;) {
    const batch = await prisma.rawPosting.findMany({
      where,
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      include: { source: { select: { slug: true } } },
    })
    if (batch.length === 0) break
    if (reprocess) cursor = batch[batch.length - 1]!.id

    for (const raw of batch) {
      result.considered++

      const adapter = getAdapter(raw.source.slug)
      const normalized = adapter.normalize(raw.payload)
      if (!normalized) {
        // Not a crash: a payload we cannot read is one posting lost, and the
        // row stays for a future run of an improved normaliser.
        result.skipped++
        continue
      }

      const contentHash = jobContentHash(normalized)

      const existing = await prisma.job.findUnique({
        where: { contentHash },
        select: { id: true, locationRaw: true },
      })

      if (existing && raw.jobId === existing.id) {
        // Already ours: refresh the fields, which is the point of reprocessing.
        await prisma.job.update({
          where: { id: existing.id },
          data: {
            title: normalized.title,
            description: normalized.description,
            applyUrl: normalized.applyUrl,
            postedAt: normalized.postedAt,
            language: normalized.language,
            // Deliberately not `locationRaw`. A job can have many postings and
            // this is only one of them, so writing this posting's location
            // here would undo the union below -- the last of ten wins and nine
            // countries vanish. The location is settled once, after the loop.
          },
        })
        result.updated++
        collectLocation(locationsByJob, existing.id, normalized.locationRaw)
        continue
      }

      if (existing) {
        // The dedup case this whole relation exists for: the same posting
        // reached twice -- through another source, or listed once per country
        // on the same board. Provenance is recorded either way.
        await prisma.rawPosting.update({ where: { id: raw.id }, data: { jobId: existing.id } })
        result.deduped++
        collectLocation(locationsByJob, existing.id, normalized.locationRaw)
        continue
      }

      const companyId = await resolveCompany(normalized.companyName, companyCache)

      const job = await prisma.job.create({
        data: {
          companyId,
          title: normalized.title,
          description: normalized.description,
          applyUrl: normalized.applyUrl,
          postedAt: normalized.postedAt,
          language: normalized.language,
          locationRaw: normalized.locationRaw,
          contentHash,
        },
        select: { id: true },
      })
      await prisma.rawPosting.update({ where: { id: raw.id }, data: { jobId: job.id } })
      collectLocation(locationsByJob, job.id, normalized.locationRaw)
      result.created++
    }
  }

  await settleLocations(locationsByJob, reprocess, result)

  return result
}

function collectLocation(map: Map<string, string[]>, jobId: string, location: string | null) {
  if (!location?.trim()) return
  const seen = map.get(jobId)
  if (seen) {
    if (!seen.includes(location)) seen.push(location)
  } else {
    map.set(jobId, [location])
  }
}

/**
 * Write each job's location as the union of its postings'.
 *
 * An employer that hires across borders says so by listing one role once per
 * country, and `jobContentHash` is company + title + applyUrl, so all of them
 * collapse into one job. Keeping only the first discarded exactly the evidence
 * that the job is open widely: on the real corpus 48 jobs held 209 locations
 * between them, every one reduced to a single country and then rejected as a
 * single office.
 *
 * A replay *replaces* rather than merges, because it has just seen every
 * posting of every job it touched -- merging there would accumulate locations a
 * source has since removed, and they would never leave again.
 */
async function settleLocations(
  locationsByJob: Map<string, string[]>,
  reprocess: boolean,
  result: NormalizeResult,
) {
  for (const [jobId, locations] of locationsByJob) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { locationRaw: true } })
    if (!job) continue

    const merged = reprocess
      ? mergeLocations(null, locations.join('; '))
      : mergeLocations(job.locationRaw, locations.join('; '))

    if (merged === job.locationRaw) continue

    await prisma.job.update({ where: { id: jobId }, data: { locationRaw: merged } })
    // The verdict was reached from a location that has now changed, so it is
    // stale. Deleting it is how `classify` finds the job again -- its
    // unprocessed filter is `eligibility: null`.
    await prisma.jobEligibility.deleteMany({ where: { jobId } })
    result.locationsMerged++
  }
}

/**
 * Finds or creates the company, matching on the normalised name so "Layered",
 * "Layered, Inc." and "layered" resolve to one row while the display name keeps
 * whatever the source said.
 */
async function resolveCompany(displayName: string, cache: Map<string, string>): Promise<string> {
  const key = normalizeCompanyName(displayName)
  const cached = cache.get(key)
  if (cached) return cached

  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM companies WHERE lower("name") = lower(${displayName}) LIMIT 1
  `
  if (matches[0]) {
    cache.set(key, matches[0].id)
    return matches[0].id
  }

  const company = await prisma.company.create({
    data: { name: displayName },
    select: { id: true },
  })
  cache.set(key, company.id)
  log('company created', { name: displayName })
  return company.id
}
