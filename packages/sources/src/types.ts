/**
 * The uniform interface every job source implements (PLAN.md §6).
 *
 * An adapter's only job is stage 1 of the pipeline: turn a source into a stream
 * of raw postings. It does not normalise, classify, or touch the database —
 * those are separate replayable stages, and keeping adapters pure is what lets
 * them be tested against recorded fixtures with no network and no Postgres.
 */

export interface FetchedPosting {
  /**
   * The source's own identifier, stable across fetches. Combined with the
   * source id this is what makes re-fetching idempotent rather than duplicating.
   */
  externalId: string
  /** The response exactly as received. Never edited — `normalize` replays from this. */
  payload: unknown
  /**
   * Hash over the fields that actually matter, so an unchanged re-fetch is a
   * no-op rather than a pointless normalize + classify + re-embed.
   */
  contentHash: string
}

export interface HttpClient {
  getJson(url: string): Promise<unknown>
}

export interface FetchContext {
  /** The `sources.config` JSON. Each adapter validates its own shape. */
  config: unknown
  http: HttpClient
  log: (message: string, detail?: Record<string, unknown>) => void
  /**
   * Report a failure the adapter recovered from — a dead board, an unparseable
   * response — so the caller can judge the run as a whole.
   *
   * Logging alone is not enough. An adapter that swallows every failure and
   * yields nothing looks identical to a source that legitimately has no new
   * postings, and the run gets recorded as a success. That is precisely the
   * silent rot PLAN.md §7 is about, and it happened: all five boards failed and
   * the source still reported healthy.
   */
  reportFailure: (scope: string, error: unknown) => void
}

export interface SourceAdapter {
  /** Matches `sources.slug`. */
  slug: string
  /**
   * Yields rather than returning an array: a large ATS board is thousands of
   * postings, and the worker should be able to persist as they arrive rather
   * than holding a full crawl in memory.
   */
  fetch(ctx: FetchContext): AsyncIterable<FetchedPosting>
}

export class SourceConfigError extends Error {
  constructor(slug: string, detail: string) {
    super(`${slug}: invalid source config — ${detail}`)
    this.name = 'SourceConfigError'
  }
}
