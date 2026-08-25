import 'server-only'

import type { FeedResult, HistoryEntry, Profile } from '@jobsearch/shared'
import { feedResultSchema, historyEntrySchema, profileSchema } from '@jobsearch/shared'
import { z } from 'zod'
import * as fixtures from './fixtures'

/**
 * THE ONLY PLACE THE WEB APP GETS DATA.
 *
 * Per PLAN.md D5 the web tier is a BFF: it may render on the server, but it
 * never reaches Postgres. Every read goes through this module, which will call
 * `apps/api` over HTTP. Until that service exists, the functions resolve
 * fixtures — swapping to the real API changes this file and nothing else.
 *
 * `server-only` makes an accidental client import a build error rather than a
 * runtime leak.
 */

const API_URL = process.env.API_URL

async function get<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  fallback: () => z.output<S>,
): Promise<z.output<S>> {
  if (!API_URL) return fallback()

  const response = await fetch(`${API_URL}${path}`, {
    headers: { accept: 'application/json' },
    next: { revalidate: 60 },
  })
  if (!response.ok) {
    throw new Error(`API ${path} failed: ${response.status} ${response.statusText}`)
  }
  // Validate at the boundary so a contract drift surfaces here, not three
  // components deep.
  return schema.parse(await response.json())
}

export function getFeed(feedId: string, now: number): Promise<FeedResult> {
  return get(`/feeds/${feedId}`, feedResultSchema, () => fixtures.feedResult(feedId, now))
}

export function listFeeds(now: number) {
  return get(
    '/feeds',
    z.array(feedResultSchema.shape.feed),
    () => fixtures.feeds(now),
  )
}

export function getProfile(): Promise<Profile> {
  return get('/profile', profileSchema, () => fixtures.profile())
}

export function getHistory(): Promise<HistoryEntry[]> {
  return get('/profile/history', z.array(historyEntrySchema), () => fixtures.history())
}
