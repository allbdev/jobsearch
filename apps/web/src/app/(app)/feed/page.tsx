import { getFeed, listFeeds } from '@/server/api-client'
import { FeedScreen } from '@/features/feed/FeedScreen'

export const dynamic = 'force-dynamic'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>
}) {
  const { feed } = await searchParams
  // Server-rendered for SEO and first paint; the data still comes from the API
  // layer, never from the database (PLAN.md D5).
  const now = Date.now()
  const feeds = await listFeeds(now)
  const activeId = feed ?? feeds[0]?.id ?? 'frontend-worldwide'
  const result = await getFeed(activeId, now)

  return <FeedScreen feeds={feeds} result={result} now={now} />
}
