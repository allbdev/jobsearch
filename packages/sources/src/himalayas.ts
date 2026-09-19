import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canonicalizeUrl, htmlToText } from '@jobsearch/core'
import {
  SourceConfigError,
  type FetchContext,
  type FetchedPosting,
  type NormalizedPosting,
  type SourceAdapter,
} from './types'

/**
 * Himalayas, an aggregator.
 *
 * Tier 3 in PLAN.md §3, and the first source that is not a company's own board.
 * The reason to add one: every ATS board we crawl was curated for hiring remote
 * across borders, and almost none of it reaches Brazil. An aggregator is the
 * only way to see the part of the market no curated list will find.
 *
 * What it is good for, measured rather than assumed: ~102,000 listings, and
 * `locationRestrictions` states per listing which countries the employer will
 * hire from. That field is the whole value here -- it is the question this
 * product exists to answer, answered by the source. It is still the
 * aggregator's claim about the employer, so it is written into `locationRaw`
 * for the classifier to judge like any other location, not trusted as a verdict.
 *
 * What it is not good for: only 5% of listings are open to LATAM or worldwide,
 * and a 1,000-listing sample held 14 frontend roles of which one was. The
 * expectation this source should be judged against is tens of eligible roles,
 * not thousands.
 */

export const HIMALAYAS_DEFAULT_BASE_URL = 'https://himalayas.app/jobs/api'

const configSchema = z.object({
  baseUrl: z.string().url().default(HIMALAYAS_DEFAULT_BASE_URL),
  /**
   * A hard stop, because the catalogue is ~102,000 listings and the API pages
   * 20 at a time -- crawling all of it would be 5,100 requests for a source
   * that yields tens of eligible roles.
   */
  maxPages: z.number().int().positive().max(500).default(30),
  /**
   * The listings are returned newest first, and roughly 200 arrive a day, so
   * this is the real bound: stop once the feed reaches postings older than the
   * last crawl could have missed. `maxPages` is the belt to its braces.
   */
  maxAgeDays: z.number().int().positive().default(3),
})

/**
 * Only the fields we depend on, and `.passthrough()` for the same reason as
 * every other adapter: the parsed object is what gets stored as `payload`, and
 * `normalize` replays from it.
 */
const jobSchema = z
  .object({
    title: z.string(),
    companyName: z.string(),
    description: z.string().optional(),
    applicationLink: z.string().optional(),
    guid: z.string(),
    pubDate: z.number(),
    locationRestrictions: z.array(z.string()).nullish(),
  })
  .passthrough()

const pageSchema = z.object({
  jobs: z.array(jobSchema),
  nextCursor: z.string().nullish(),
})

const pageUrl = (baseUrl: string, cursor: string | null) =>
  `${baseUrl}?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`

/**
 * Hash over what would change a conclusion. `pubDate` is in it, unlike
 * Greenhouse's `updated_at`: this source has no separate edit timestamp, so
 * the publish date moving is the only signal that a listing was reposted.
 */
export function himalayasContentHash(job: z.infer<typeof jobSchema>): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        job.guid,
        job.title,
        job.companyName,
        job.pubDate,
        job.locationRestrictions ?? [],
        job.description ?? '',
      ]),
    )
    .digest('hex')
}

/**
 * Where the employer will hire from, written the way the eligibility rules
 * already read a location.
 *
 * Every listing on this board is remote, so the "Remote" prefix is a fact
 * about the source rather than an inference, and "Remote — Brazil; Mexico" is
 * the exact shape `REMOTE_WITH_REGION` settles for free. An empty list is the
 * source saying it knows of no restriction, which is *not* the same as saying
 * the job is worldwide -- so it produces a bare "Remote" and the classifier
 * treats it as the open question it is.
 */
export function himalayasLocation(restrictions: readonly string[] | null | undefined): string {
  const places = (restrictions ?? []).map((place) => place.trim()).filter(Boolean)
  return places.length > 0 ? `Remote — ${places.join('; ')}` : 'Remote'
}

/** Looser than the fetch schema: it runs over payloads stored by older builds. */
const normalizeSchema = z
  .object({
    title: z.string(),
    companyName: z.string(),
    description: z.string().optional(),
    applicationLink: z.string().optional(),
    guid: z.string().optional(),
    pubDate: z.number().optional(),
    locationRestrictions: z.array(z.string()).nullish(),
  })
  .passthrough()

export const himalayasAdapter: SourceAdapter = {
  slug: 'himalayas',

  normalize(payload: unknown): NormalizedPosting | null {
    const parsed = normalizeSchema.safeParse(payload)
    if (!parsed.success) return null

    const job = parsed.data
    if (job.pubDate === undefined) return null
    // Unix seconds, and the only date the source gives.
    const postedAt = new Date(job.pubDate * 1000)
    if (Number.isNaN(postedAt.getTime())) return null

    const applyUrl = job.applicationLink?.trim() || job.guid?.trim()
    if (!applyUrl) return null

    const companyName = job.companyName.trim()
    if (!companyName) return null

    return {
      title: job.title.trim(),
      companyName,
      applyUrl: canonicalizeUrl(applyUrl),
      description: htmlToText(job.description ?? ''),
      postedAt,
      locationRaw: himalayasLocation(job.locationRestrictions),
      // The source states no language, and every listing is in English in every
      // sample taken. Guessing one would be inventing a field (PLAN.md §6).
      language: null,
    }
  },

  async *fetch(ctx: FetchContext): AsyncIterable<FetchedPosting> {
    const parsed = configSchema.safeParse(ctx.config)
    if (!parsed.success) {
      throw new SourceConfigError('himalayas', parsed.error.issues[0]?.message ?? 'unknown')
    }

    const { baseUrl, maxPages, maxAgeDays } = parsed.data
    const oldest = Date.now() - maxAgeDays * 86_400_000
    let cursor: string | null = null
    let yielded = 0

    for (let page = 0; page < maxPages; page++) {
      let raw: unknown
      try {
        raw = await ctx.http.getJson(pageUrl(baseUrl, cursor))
      } catch (error) {
        // A page that fails mid-crawl ends this run rather than abandoning it:
        // the pages already yielded are real postings, and the cursor cannot be
        // advanced past a response that never arrived.
        ctx.log('page fetch failed', { page, error: String(error) })
        ctx.reportFailure(`page:${page}`, error)
        return
      }

      const parsedPage = pageSchema.safeParse(raw)
      if (!parsedPage.success) {
        ctx.log('page response did not match the expected shape', {
          page,
          issue: parsedPage.error.issues[0]?.message,
        })
        ctx.reportFailure(`page:${page}`, parsedPage.error)
        return
      }

      for (const job of parsedPage.data.jobs) {
        yield {
          // The listing URL, which is what this source uses as its own id.
          externalId: job.guid,
          payload: job,
          contentHash: himalayasContentHash(job),
        }
        yielded++
      }

      const last = parsedPage.data.jobs.at(-1)
      // Newest first, so the last listing on the page is the oldest seen. Once
      // that is past the window, every page after it is older still.
      if (last && last.pubDate * 1000 < oldest) {
        ctx.log('reached the age window', { pages: page + 1, postings: yielded, maxAgeDays })
        return
      }

      cursor = parsedPage.data.nextCursor ?? null
      if (!cursor || parsedPage.data.jobs.length === 0) break
    }

    ctx.log('crawl complete', { postings: yielded, maxPages })
  },
}
