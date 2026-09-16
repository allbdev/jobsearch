'use server'

import { getLocale } from 'next-intl/server'
import type { FeedDefinition } from '@jobsearch/shared'
import { feedDefinitionInputSchema } from '@jobsearch/shared'
import { redirect } from '@/i18n/navigation'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'

/** Message keys under `feed.errors`. */
export type FeedError = 'invalid' | 'feedLimit' | 'notFound' | 'unavailable'

export interface FeedActionFailure {
  error: FeedError
  /** Top-level field names the shared schema refused, for highlighting. */
  fields?: string[]
}

/**
 * Creates a feed (`feedId` null) or replaces one, then opens it.
 *
 * Validated here with the same schema the API applies (#59), so a bad draft
 * never makes the round trip -- and the API validates again, because this is
 * not the only client it will ever have.
 */
export async function saveFeedAction(
  feedId: string | null,
  // The loose read shape: this is exactly the input the strict schema is for.
  definition: FeedDefinition,
): Promise<FeedActionFailure> {
  const parsed = feedDefinitionInputSchema.safeParse(definition)
  if (!parsed.success) {
    return { error: 'invalid', fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] }
  }

  let saved: Awaited<ReturnType<typeof api.saveFeed>>
  try {
    saved = await api.saveFeed(feedId, parsed.data)
  } catch (error) {
    return { error: toFeedError(error) }
  }
  // Outside the try: `redirect` works by throwing.
  redirect({ href: `/feed?feed=${encodeURIComponent(saved.id)}`, locale: await getLocale() })
  return { error: 'unavailable' }
}

export async function deleteFeedAction(feedId: string): Promise<FeedActionFailure> {
  try {
    await api.deleteFeed(feedId)
  } catch (error) {
    return { error: toFeedError(error) }
  }
  redirect({ href: '/feed', locale: await getLocale() })
  return { error: 'unavailable' }
}

function toFeedError(error: unknown): FeedError {
  if (!(error instanceof ApiError)) return 'unavailable'
  if (error.status === 400) return 'invalid'
  if (error.status === 404) return 'notFound'
  if (error.status === 409) return 'feedLimit'
  return 'unavailable'
}
