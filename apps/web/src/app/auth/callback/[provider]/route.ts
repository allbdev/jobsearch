import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ApiError, completeOAuth } from '@/server/api-client'
import { backToSignIn, oauthPendingSchema } from '@/server/oauth'
import { setSession } from '@/server/session'
import { OAUTH_COOKIE } from '@/server/session-cookie'

/**
 * Where Google and GitHub send the browser back. The URL is registered with
 * each provider exactly, which is why it sits outside the locale segment.
 *
 * `state` is checked here, against the cookie set when this browser started the
 * sign-in: a callback this browser did not start -- a login-CSRF link that
 * would sign the victim into the attacker's account -- has no matching cookie.
 */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(request.url)
  const raw = (await cookies()).get(OAUTH_COOKIE)?.value
  const pending = oauthPendingSchema.safeParse(raw ? safeJson(raw) : null)
  if (!pending.success) return backToSignIn(request, 'en', 'failed')

  const { locale, provider, state, codeVerifier } = pending.data
  if (provider !== (await params).provider || url.searchParams.get('state') !== state) {
    return backToSignIn(request, locale, 'failed')
  }
  // The person said no on the provider's page.
  if (url.searchParams.get('error')) return backToSignIn(request, locale, 'cancelled')

  const code = url.searchParams.get('code')
  if (!code) return backToSignIn(request, locale, 'failed')

  let session: Awaited<ReturnType<typeof completeOAuth>>
  try {
    session = await completeOAuth(provider, { code, codeVerifier })
  } catch (error) {
    const reason = error instanceof ApiError ? (error.body as { reason?: string } | undefined)?.reason : undefined
    if (reason === 'email_unverified') return backToSignIn(request, locale, 'email_unverified')
    if (error instanceof ApiError && error.status === 429) return backToSignIn(request, locale, 'tooMany')
    return backToSignIn(request, locale, 'failed')
  }

  await setSession(session)
  const response = NextResponse.redirect(new URL(`/${locale}/feed`, request.url), 303)
  response.cookies.delete(OAUTH_COOKIE)
  return response
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
