import { AuthScreen } from '@/features/auth/AuthScreen'
import { countryOptions } from '@/features/profile/profile-options'
import type { Locale } from '@/i18n/routing'

/** Prerendered per locale; the country names are built here, once, not in the browser. */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <AuthScreen countries={countryOptions(locale as Locale)} />
}
