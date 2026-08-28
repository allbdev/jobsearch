import { prisma, type Prisma } from '@jobsearch/db'
import { jobContentHash, normalizeCompanyName } from '@jobsearch/core'
import { getAdapter } from '@jobsearch/sources'
import { log } from './log'

export interface NormalizeResult {
  considered: number
  created: number
  updated: number
  deduped: number
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
  const result: NormalizeResult = { considered: 0, created: 0, updated: 0, deduped: 0, skipped: 0 }

  const where: Prisma.RawPostingWhereInput = {
    ...(reprocess ? {} : { jobId: null }),
    ...(slug ? { source: { slug } } : {}),
  }

  // Company lookups repeat heavily — one board is one company for hundreds of
  // postings — so the resolved ids are cached for the run.
  const companyCache = new Map<string, string>()

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
        select: { id: true },
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
            locationRaw: normalized.locationRaw,
          },
        })
        result.updated++
        continue
      }

      if (existing) {
        // The dedup case this whole relation exists for: the same posting
        // reached through another source. The job stays as it is; the raw
        // posting records that it resolved here, so we keep provenance.
        await prisma.rawPosting.update({ where: { id: raw.id }, data: { jobId: existing.id } })
        result.deduped++
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
      result.created++
    }
  }

  return result
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
