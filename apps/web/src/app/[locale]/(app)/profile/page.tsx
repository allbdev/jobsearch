import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import type { Profile } from '@jobsearch/shared'
import { type Locale } from '@/i18n/routing'
import { getHistory, getMe, getProfile } from '@/server/api-client'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
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
      profile={profile ?? (await firstProfile(locale))}
      isNew={profile === null}
      history={history}
      options={profileOptions(locale)}
    />
  )
}

/**
 * What the form starts from before anything is saved. Residence is left empty
 * on purpose: it is the one field that blocks matches, so it is chosen, never
 * guessed.
 */
async function firstProfile(locale: Locale): Promise<Profile> {
  const me = await getMe()
  return {
    residenceCountry: '',
    timezone: 'UTC',
    targetRegions: [],
    languages: [],
    jobFamilies: [],
    targetRoles: '',
    seniority: 'mid',
    skills: [],
    contractModels: [],
    minCompensation: null,
    currency: 'USD',
    email: me.email,
    interfaceLanguage: locale,
    digest: { cadence: 'weekly', sendOn: 'monday', sendAt: '08:00', language: locale },
  }
}
