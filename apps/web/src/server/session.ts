import 'server-only'

import { cookies } from 'next/headers'
import type { SessionResponse } from '@jobsearch/shared'
import { SESSION_COOKIE } from './session-cookie'

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value
}

/**
 * httpOnly so no script on the page can read the token, Lax so a link from
 * another site still arrives signed in while a cross-site POST does not, and
 * Secure outside development so it never crosses plain HTTP.
 */
export async function setSession(session: SessionResponse): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.expiresAt),
  })
}

export async function clearSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
