import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

/**
 * Locale negotiation only: picks a locale from the path, a cookie, or the
 * Accept-Language header, and redirects `/` to a prefixed URL.
 *
 * Deliberately no business logic and no data access — PLAN.md D5 keeps the web
 * tier a BFF, and this stays presentation routing.
 */
export default createMiddleware(routing)

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
