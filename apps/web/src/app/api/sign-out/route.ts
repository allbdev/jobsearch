import { NextResponse } from 'next/server'
import { signOut } from '@/server/api-client'
import { clearSession } from '@/server/session'

/**
 * POST only: a sign-out reachable by GET can be triggered by any image tag on
 * any site.
 *
 * The API revokes the session first, so a copied cookie stops working too; the
 * cookie is cleared even if that call fails, because the person asked to be
 * signed out of *this* browser regardless.
 */
export async function POST(request: Request) {
  await signOut().catch(() => undefined)
  await clearSession()
  return NextResponse.redirect(new URL('/', request.url), 303)
}
