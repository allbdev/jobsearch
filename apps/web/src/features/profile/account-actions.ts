'use server'

import { getLocale } from 'next-intl/server'
import type { OAuthProvider } from '@jobsearch/shared'
import { redirect } from '@/i18n/navigation'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'
import { clearSession } from '@/server/session'

/** Keys under `profile.account`. */
export type AccountOutcome =
  | 'unlinked'
  | 'last_way_in'
  | 'not_linked'
  | 'wrong_password'
  | 'confirmation_required'
  | 'tooMany'
  | 'unavailable'

export interface AccountActionResult {
  ok: boolean
  outcome?: AccountOutcome
}

export async function unlinkConnectionAction(provider: OAuthProvider): Promise<AccountActionResult> {
  try {
    await api.unlinkConnection(provider)
    return { ok: true, outcome: 'unlinked' }
  } catch (error) {
    return { ok: false, outcome: reasonOf(error) }
  }
}

/**
 * Deletes the account, then clears the cookie and leaves for the landing page.
 *
 * The session is dead server-side either way -- it went with the account -- so
 * the cookie is cleared before redirecting rather than leaving the browser to
 * discover it on the next request.
 */
export async function deleteAccountAction(_: AccountActionResult, form: FormData): Promise<AccountActionResult> {
  try {
    await api.deleteAccount({
      password: String(form.get('password') ?? '') || undefined,
      confirm: String(form.get('confirm') ?? '') || undefined,
    })
  } catch (error) {
    return { ok: false, outcome: reasonOf(error) }
  }
  await clearSession()
  redirect({ href: '/', locale: await getLocale() })
  return { ok: true }
}

function reasonOf(error: unknown): AccountOutcome {
  if (!(error instanceof ApiError)) return 'unavailable'
  if (error.status === 429) return 'tooMany'
  const reason = (error.body as { reason?: string } | undefined)?.reason
  const known: AccountOutcome[] = ['last_way_in', 'not_linked', 'wrong_password', 'confirmation_required']
  return known.find((value) => value === reason) ?? 'unavailable'
}
