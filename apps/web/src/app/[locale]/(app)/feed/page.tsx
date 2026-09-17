import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { feedSortSchema } from '@jobsearch/shared'
import { redirect } from '@/i18n/navigation'
import { ApiError, getFeed, listFeeds } from '@/server/api-client'
import { FeedScreen } from '@/features/feed/FeedScreen'
import { NoFeeds } from '@/features/feed/NoFeeds'

export const dynamic = 'force-dynamic'

/**
 * A personalised feed is per-user and behind auth; it should never be indexed,
 * and it needs no hreflang alternates. This overrides the locale layout's
 * alternates, which are meant for the public landing page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; sort?: string }>
}) {
  const { feed, sort } = await searchParams
  // Sorting is the server's: it orders the whole feed, not the page in hand.
  const parsedSort = feedSortSchema.safeParse(sort)
  const order = parsedSort.success ? parsedSort.data : 'best_match'
  // Server-rendered for SEO and first paint; the data still comes from the API
  // layer, never from the database (PLAN.md D5).
  const now = Date.now()
  try {
    const feeds = await listFeeds(now)
    const activeId = feed ?? feeds[0]?.id
    if (!activeId) return <NoFeeds />

    const result = await getFeed(activeId, now, { sort: order })
    return <FeedScreen feeds={feeds} result={result} now={now} sort={order} />
  } catch (error) {
    // The cookie was there (middleware checked) but the API refused it: expired,
    // or signed out elsewhere. Back to the landing page to sign in again.
    if (error instanceof ApiError && error.status === 401) redirect({ href: '/', locale: await getLocale() })
    // Not theirs, or gone. The API does not distinguish, and neither do we.
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }
}
