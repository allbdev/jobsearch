import 'server-only'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { oauthProviderSchema } from '@jobsearch/shared'
import { defaultLocale, locales, type Locale } from '@/i18n/routing'
import { OAUTH_COOKIE } from './session-cookie'

/** What must survive the round trip through Google or GitHub. */
export const oauthPendingSchema = z.object({
  provider: oauthProviderSchema,
  state: z.string(),
  codeVerifier: z.string().nullable(),
  locale: z.enum(locales),
})
export type OAuthPending = z.infer<typeof oauthPendingSchema>

export function toLocale(value: string | null | undefined): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale
}

/** Back to the sign-in page with a reason `OAuthNotice` knows how to say. */
export function backToSignIn(request: Request, locale: Locale, outcome: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/${locale}?oauth=${outcome}`, request.url), 303)
  response.cookies.delete(OAUTH_COOKIE)
  return response
}
