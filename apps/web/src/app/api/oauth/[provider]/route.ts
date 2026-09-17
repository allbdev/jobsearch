import { NextResponse } from 'next/server'
import { oauthProviderSchema } from '@jobsearch/shared'
import { ApiError, startOAuth } from '@/server/api-client'
import { backToSignIn, toLocale, type OAuthPending } from '@/server/oauth'
import { OAUTH_COOKIE } from '@/server/session-cookie'

/**
 * Starts a Google or GitHub sign-in: asks the API where to send the browser,
 * remembers what the callback will need to check, and sends it there.
 */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(request.url)
  const locale = toLocale(url.searchParams.get('locale'))
  const provider = oauthProviderSchema.safeParse((await params).provider)
  if (!provider.success) return backToSignIn(request, locale, 'unavailable')

  let start: Awaited<ReturnType<typeof startOAuth>>
  try {
    start = await startOAuth(provider.data)
  } catch (error) {
    // 404 is the API saying this provider has no credentials configured.
    return backToSignIn(request, locale, error instanceof ApiError && error.status === 429 ? 'tooMany' : 'unavailable')
  }

  const pending: OAuthPending = { provider: provider.data, state: start.state, codeVerifier: start.codeVerifier, locale }
  const response = NextResponse.redirect(start.url, 302)
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    // Lax, not Strict: the callback is a top-level navigation *from* the
    // provider's site, and Strict would withhold the cookie from exactly it.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
  return response
}
