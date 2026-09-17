import type { Profile } from '@jobsearch/shared'
import type { Locale } from '@/i18n/routing'

/**
 * The profile an account starts from: what the profile screen shows before
 * anything is saved, and what registration saves with the few answers the
 * sign-up form collects. One definition, so the two cannot drift.
 *
 * Residence defaults to empty on purpose: it is the one field that blocks
 * matches, so it is chosen, never guessed.
 */
export function firstProfile({
  locale,
  residenceCountry = '',
  timezone = 'UTC',
  digest = true,
}: {
  locale: Locale
  residenceCountry?: string
  timezone?: string
  digest?: boolean
}): Omit<Profile, 'email'> {
  return {
    residenceCountry,
    timezone,
    targetRegions: [],
    languages: [],
    jobFamilies: [],
    targetRoles: '',
    seniority: 'mid',
    skills: [],
    contractModels: [],
    minCompensation: null,
    currency: 'USD',
    interfaceLanguage: locale,
    digest: { cadence: digest ? 'weekly' : 'off', sendOn: 'monday', sendAt: '08:00', language: locale },
  }
}
