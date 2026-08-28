import { createHash } from 'node:crypto'
import { z } from 'zod'
import { SourceConfigError, type FetchContext, type FetchedPosting, type SourceAdapter } from './types'

/**
 * Greenhouse job boards.
 *
 * Tier 1 in PLAN.md §3, and the structural backbone of the index: a company's
 * board lists *every* open role, so one integration yields engineering, design,
 * marketing, support and finance at once. That is what makes the profession-
 * agnostic promise of D9 achievable without a niche board per profession.
 *
 * The public board API needs no key and no scraping.
 */

export const GREENHOUSE_DEFAULT_BASE_URL = 'https://boards-api.greenhouse.io/v1'

const configSchema = z.object({
  /**
   * Greenhouse board tokens — the company slug in
   * `boards.greenhouse.io/<token>`. Curated: companies known to hire remote
   * across borders (PLAN.md §3).
   */
  boards: z.array(z.string().min(1)).min(1),
  /**
   * Overridable per source row, so a staging environment can point at a mock
   * and an endpoint move can be corrected without a deploy.
   *
   * Worth being clear about what this does and does not buy. It helps only if
   * the *path shape* stays the same. If Greenhouse restructures the endpoint or
   * changes the response, the parsing changes too and a code change is needed
   * regardless — no amount of configurability avoids that. It lives in
   * `sources.config` rather than an environment variable because config is
   * per-source, and a dozen sources would otherwise mean a dozen global vars.
   */
  baseUrl: z.string().url().default(GREENHOUSE_DEFAULT_BASE_URL),
})

/**
 * Only the fields we depend on. Greenhouse sends about twenty per job and adds
 * more over time; validating the whole shape would turn their feature releases
 * into our outages.
 *
 * `.passthrough()` is load-bearing, not decoration. Zod strips unknown keys by
 * default, and the parsed object is what gets stored as `payload` — so without
 * it this silently discarded `company_name`, `first_published`, `language`,
 * `departments` and `offices`, which are exactly the fields `normalize` needs.
 * The raw payload has to stay raw for the stage to be replayable at all.
 */
const jobSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    absolute_url: z.string(),
    updated_at: z.string(),
    content: z.string().optional(),
    location: z.object({ name: z.string() }).nullish(),
  })
  .passthrough()

const boardSchema = z.object({ jobs: z.array(jobSchema) })

const boardUrl = (baseUrl: string, board: string) =>
  `${baseUrl.replace(/\/$/, '')}/boards/${encodeURIComponent(board)}/jobs?content=true`

/**
 * Hash of the fields that change what we would conclude about a posting.
 *
 * `updated_at` is deliberately excluded: Greenhouse bumps it on edits that do
 * not touch the text — a re-order, a department rename — and including it would
 * re-run classification and re-embed for nothing. Money and rate limit, spent
 * to learn the posting is identical.
 */
export function greenhouseContentHash(job: z.infer<typeof jobSchema>): string {
  return createHash('sha256')
    .update(
      JSON.stringify([job.id, job.title, job.absolute_url, job.location?.name ?? '', job.content ?? '']),
    )
    .digest('hex')
}

export const greenhouseAdapter: SourceAdapter = {
  slug: 'greenhouse',

  async *fetch(ctx: FetchContext): AsyncIterable<FetchedPosting> {
    const parsed = configSchema.safeParse(ctx.config)
    if (!parsed.success) {
      throw new SourceConfigError('greenhouse', parsed.error.issues[0]?.message ?? 'unknown')
    }

    const { boards, baseUrl } = parsed.data

    for (const board of boards) {
      let raw: unknown
      try {
        raw = await ctx.http.getJson(boardUrl(baseUrl, board))
      } catch (error) {
        // One dead board must not abandon the rest of the crawl. Boards are
        // removed and renamed constantly; that is a curation problem to report,
        // not a reason to lose the other 40 companies in this run.
        ctx.log('board fetch failed', { board, error: String(error) })
        ctx.reportFailure(`board:${board}`, error)
        continue
      }

      const board_ = boardSchema.safeParse(raw)
      if (!board_.success) {
        ctx.log('board response did not match the expected shape', {
          board,
          issue: board_.error.issues[0]?.message,
        })
        ctx.reportFailure(`board:${board}`, board_.error)
        continue
      }

      ctx.log('board fetched', { board, jobs: board_.data.jobs.length })

      for (const job of board_.data.jobs) {
        yield {
          // Namespaced by board: Greenhouse job ids are unique per board, not
          // globally, so a bare id would collide across companies.
          externalId: `${board}:${job.id}`,
          payload: job,
          contentHash: greenhouseContentHash(job),
        }
      }
    }
  },
}
