import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { type Locale } from '@/i18n/routing'
import { getHistory, getMe, getProfile } from '@/server/api-client'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { firstProfile } from '@/features/profile/first-profile'
import { profileOptions } from '@/features/profile/profile-options'

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
  const locale = (await getLocale()) as Locale
  const [profile, history] = await Promise.all([getProfile(), getHistory()])
  return (
    <ProfileScreen
      profile={profile ?? { ...firstProfile({ locale }), email: (await getMe()).email }}
      isNew={profile === null}
      history={history}
      options={profileOptions(locale)}
    />
  )
}
