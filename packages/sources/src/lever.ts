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
 * Lever job boards.
 *
 * The second Tier 1 ATS (PLAN.md §3). Same shape of value as Greenhouse — one
 * integration yields every profession at a company — and the second source is
 * what makes cross-source dedup testable at all, since `sources.slug` is unique
 * and one adapter can never produce the same job twice from two places.
 *
 * Lever states two things Greenhouse does not, and both are worth more than
 * the extra adapter:
 *
 *   workplaceType   'remote' | 'hybrid' | 'onsite', declared per posting
 *   country         ISO 3166-1 alpha-2
 *
 * Greenhouse leaves both to be inferred from prose, which is exactly the work
 * the classifier is paying an LLM to do.
 */

export const LEVER_DEFAULT_BASE_URL = 'https://api.lever.co/v0'

const boardSchema = z.object({
  /** The company slug in `jobs.lever.co/<slug>`. */
  slug: z.string().min(1),
  /**
   * Display name. It has to be configured because Lever does not put the
   * company anywhere in the posting — the board *is* the company — and
   * title-casing the slug gets "Quintoandar" for QuintoAndar.
   */
  name: z.string().min(1),
})

const configSchema = z.object({
  boards: z.array(boardSchema).min(1),
  /** Same rationale as the Greenhouse adapter's: per-source, not a global env var. */
  baseUrl: z.string().url().default(LEVER_DEFAULT_BASE_URL),
})

/**
 * `.passthrough()` on every object, including the nested ones.
 *
 * Zod strips unknown keys per object, not per tree, so a top-level
 * `.passthrough()` still silently empties a nested one. That is what happened
 * here: `categories` kept `location` and `allLocations` and dropped
 * `commitment`, `department` and `team` -- the fields a job-family classifier
 * (D12) will want, gone from the stored payload with nothing raising a word.
 * The same mistake at the top level was #20.
 */
const listSchema = z
  .object({ text: z.string().optional(), content: z.string().optional() })
  .passthrough()

const postingSchema = z
  .object({
    id: z.string().min(1),
    text: z.string(),
    hostedUrl: z.string(),
    createdAt: z.number().optional(),
    country: z.string().nullish(),
    workplaceType: z.string().nullish(),
    descriptionPlain: z.string().optional(),
    openingPlain: z.string().optional(),
    additionalPlain: z.string().optional(),
    lists: z.array(listSchema).optional(),
    categories: z
      .object({ location: z.string().nullish(), allLocations: z.array(z.string()).nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough()

const responseSchema = z.array(postingSchema)

/**
 * What gets stored as `payload`.
 *
 * Greenhouse's payload can be stored verbatim because it carries
 * `company_name`. Lever's cannot: the company is the board slug and appears
 * nowhere in the posting, so a bare posting is not enough to normalize from and
 * the stage stops being replayable — the whole point of `raw_postings`.
 *
 * The posting itself is still stored untouched, under `posting`. The envelope
 * adds identity, it does not edit the response.
 */
export interface LeverPayload {
  board: string
  company: string
  posting: unknown
}

const payloadSchema = z.object({
  board: z.string(),
  company: z.string(),
  posting: postingSchema,
})

const boardUrl = (baseUrl: string, board: string) =>
  `${baseUrl.replace(/\/$/, '')}/postings/${encodeURIComponent(board)}?mode=json`

/**
 * Hash over what would change a conclusion. `createdAt` is excluded for the
 * same reason Greenhouse's `updated_at` is: it moves on edits that do not touch
 * anything we read, and re-running classify costs real money.
 */
export function leverContentHash(posting: z.infer<typeof postingSchema>): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        posting.id,
        posting.text,
        posting.hostedUrl,
        posting.workplaceType ?? '',
        posting.categories?.location ?? '',
        posting.descriptionPlain ?? '',
      ]),
    )
    .digest('hex')
}

/**
 * Render Lever's two location fields as one string the eligibility rules
 * already understand.
 *
 * `workplaceType` is a declared fact, not a guess, and the rules read the
 * location field before anything else: `NOT_REMOTE_LOCATION` matches a leading
 * "Hybrid"/"On-site", and `REMOTE_WITH_REGION` matches "Remote — <place>". So
 * writing Lever's own answer in that form settles most of this source with the
 * free pass instead of sending it to the LLM.
 *
 * Nothing is inferred here. An absent `workplaceType` produces the bare
 * location, and an absent location produces the bare workplace type; neither is
 * invented to make a rule fire.
 */
export function leverLocation(posting: z.infer<typeof postingSchema>): string | null {
  const places =
    posting.categories?.allLocations?.filter((place) => place.trim()) ??
    (posting.categories?.location ? [posting.categories.location] : [])
  const where = places.join('; ').trim()

  const prefix = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }[
    (posting.workplaceType ?? '').toLowerCase()
  ]

  if (prefix && where) return `${prefix} — ${where}`
  return prefix ?? (where || null)
}

/**
 * Lever splits a description across four fields and an array of sections.
 * `descriptionPlain` alone drops the requirements list, which is where a work
 * authorisation clause usually lives -- the single most decisive sentence for
 * this product.
 */
function leverDescription(posting: z.infer<typeof postingSchema>): string {
  const sections = [posting.openingPlain, posting.descriptionPlain]

  for (const list of posting.lists ?? []) {
    // `text` is the heading and is already plain; `content` is HTML.
    if (list.text) sections.push(list.text)
    if (list.content) sections.push(htmlToText(list.content))
  }

  sections.push(posting.additionalPlain)
  return sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join('\n\n')
}

export const leverAdapter: SourceAdapter = {
  slug: 'lever',

  normalize(payload: unknown): NormalizedPosting | null {
    const parsed = payloadSchema.safeParse(payload)
    if (!parsed.success) return null

    const { company, posting } = parsed.data
    if (posting.createdAt === undefined) return null
    const postedAt = new Date(posting.createdAt)
    if (Number.isNaN(postedAt.getTime())) return null

    const title = posting.text.trim()
    if (!title) return null

    return {
      title,
      companyName: company.trim(),
      applyUrl: canonicalizeUrl(posting.hostedUrl),
      description: leverDescription(posting),
      postedAt,
      locationRaw: leverLocation(posting),
      // Lever exposes no language field. Null is the honest answer; guessing
      // from the text would be a classifier's job, not an adapter's.
      language: null,
    }
  },

  async *fetch(ctx: FetchContext): AsyncIterable<FetchedPosting> {
    const parsed = configSchema.safeParse(ctx.config)
    if (!parsed.success) {
      throw new SourceConfigError('lever', parsed.error.issues[0]?.message ?? 'unknown')
    }

    const { boards, baseUrl } = parsed.data

    for (const board of boards) {
      let raw: unknown
      try {
        raw = await ctx.http.getJson(boardUrl(baseUrl, board.slug))
      } catch (error) {
        ctx.log('board fetch failed', { board: board.slug, error: String(error) })
        ctx.reportFailure(`board:${board.slug}`, error)
        continue
      }

      const postings = responseSchema.safeParse(raw)
      if (!postings.success) {
        ctx.log('board response did not match the expected shape', {
          board: board.slug,
          issue: postings.error.issues[0]?.message,
        })
        ctx.reportFailure(`board:${board.slug}`, postings.error)
        continue
      }

      // A live board that returns `[]` is not an error -- Lever answers 200
      // with an empty array for a company with nothing open -- but a board slug
      // that is merely wrong answers 404 and is caught above. Reporting the
      // empty case would cry wolf on every quiet company.
      ctx.log('board fetched', { board: board.slug, postings: postings.data.length })

      for (const posting of postings.data) {
        yield {
          externalId: `${board.slug}:${posting.id}`,
          payload: { board: board.slug, company: board.name, posting } satisfies LeverPayload,
          contentHash: leverContentHash(posting),
        }
      }
    }
  },
}
