import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { locales, routing } from './i18n/routing'
import { SESSION_COOKIE } from './server/session-cookie'

const intl = createMiddleware(routing)

const SIGNED_IN_ONLY = new RegExp(`^/(${locales.join('|')})/(feed|profile)(/|$)`)

/**
 * Locale negotiation, plus one redirect: a signed-in page requested with no
 * session cookie goes to the landing page.
 *
 * Deliberately no business logic and no data access (PLAN.md D5), and it never
 * decides whether a cookie is *valid* -- that is the API's call (D15). A stale
 * cookie gets through here and is refused by the API on the first read.
 *
 * Skipped without API_URL, where the screens render fixtures and there is
 * nothing to sign in to.
 */
export default function middleware(request: NextRequest) {
  const match = SIGNED_IN_ONLY.exec(request.nextUrl.pathname)
  if (process.env.API_URL && match && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(`/${match[1]}`, request.url))
  }
  return intl(request)
}

export const config = {
  // Everything except API routes, the OAuth callback, Next internals and files
  // with an extension. The callback is registered with Google and GitHub as
  // exactly `/auth/callback/<provider>`; a locale redirect would add a hop
  // between the provider and the code exchange for no benefit.
  matcher: '/((?!api|auth/callback|_next|_vercel|.*\\..*).*)',
}
