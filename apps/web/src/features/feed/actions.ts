'use server'

import type { FeedDefinition } from '@jobsearch/shared'
import { feedDefinitionInputSchema } from '@jobsearch/shared'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'

/** Message keys under `feed.errors`. */
export type FeedError = 'invalid' | 'feedLimit' | 'notFound' | 'unavailable'

export interface FeedActionFailure {
  ok: false
  error: FeedError
  /** Top-level field names the shared schema refused, for highlighting. */
  fields?: string[]
}

/**
 * Success is returned, not redirected to. The dialog that called the action is
 * the one that knows it should close, and a redirect would leave it to infer
 * that from the page re-rendering underneath it.
 */
export type FeedActionResult = { ok: true; href: string } | FeedActionFailure

/**
 * Creates a feed (`feedId` null) or replaces one, and says where it lives.
 *
 * Validated here with the same schema the API applies (#59), so a bad draft
 * never makes the round trip -- and the API validates again, because this is
 * not the only client it will ever have.
 */
export async function saveFeedAction(
  feedId: string | null,
  // The loose read shape: this is exactly the input the strict schema is for.
  definition: FeedDefinition,
): Promise<FeedActionResult> {
  const parsed = feedDefinitionInputSchema.safeParse(definition)
  if (!parsed.success) {
    return { ok: false, error: 'invalid', fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] }
  }

  try {
    const saved = await api.saveFeed(feedId, parsed.data)
    return { ok: true, href: `/feed?feed=${encodeURIComponent(saved.id)}` }
  } catch (error) {
    return { ok: false, error: toFeedError(error) }
  }
}

export async function deleteFeedAction(feedId: string): Promise<FeedActionResult> {
  try {
    await api.deleteFeed(feedId)
    return { ok: true, href: '/feed' }
  } catch (error) {
    return { ok: false, error: toFeedError(error) }
  }
}

function toFeedError(error: unknown): FeedError {
  if (!(error instanceof ApiError)) return 'unavailable'
  if (error.status === 400) return 'invalid'
  if (error.status === 404) return 'notFound'
  if (error.status === 409) return 'feedLimit'
  return 'unavailable'
}
