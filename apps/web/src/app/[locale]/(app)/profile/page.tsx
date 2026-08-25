import type { Metadata } from 'next'
import { getHistory, getProfile } from '@/server/api-client'
import { ProfileScreen } from '@/features/profile/ProfileScreen'

export const dynamic = 'force-dynamic'

/**
 * A personalised profile is per-user and behind auth; it should never be indexed,
 * and it needs no hreflang alternates. This overrides the locale layout's
 * alternates, which are meant for the public landing page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
}

export default async function ProfilePage() {
  const [profile, history] = await Promise.all([getProfile(), getHistory()])
  return <ProfileScreen profile={profile} history={history} />
}
