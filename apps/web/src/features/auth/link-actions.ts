'use server'

import { getLocale } from 'next-intl/server'
import { emailSchema, emailTokenFailureSchema, passwordSchema } from '@jobsearch/shared'
import { redirect } from '@/i18n/navigation'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'
import { setSession } from '@/server/session'

/**
 * Outcomes of the pages an emailed link opens. Keys under `auth.links` or
 * `auth.errors`; the screens pick the sentence.
 */
export type LinkStatus =
  | 'sent'
  | 'verified'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'emailInvalid'
  | 'passwordTooShort'
  | 'tooMany'
  | 'unavailable'

export interface LinkFormState {
  status?: LinkStatus
}

export async function forgotPasswordAction(_: LinkFormState, form: FormData): Promise<LinkFormState> {
  const email = emailSchema.safeParse(form.get('email'))
  if (!email.success) return { status: 'emailInvalid' }
  try {
    await api.requestPasswordReset(email.data)
    // The same answer whether or not the address has an account (#52).
    return { status: 'sent' }
  } catch (error) {
    return { status: toStatus(error) }
  }
}

export async function resetPasswordAction(_: LinkFormState, form: FormData): Promise<LinkFormState> {
  const password = passwordSchema.safeParse(form.get('password'))
  if (!password.success) return { status: 'passwordTooShort' }

  let session: Awaited<ReturnType<typeof api.resetPassword>>
  try {
    session = await api.resetPassword({ token: String(form.get('token') ?? ''), password: password.data })
  } catch (error) {
    return { status: toStatus(error) }
  }
  // A reset signs this browser in (#52); outside the try, `redirect` throws.
  await setSession(session)
  redirect({ href: '/feed', locale: await getLocale() })
  return {}
}

/**
 * Behind a button, not run when the page loads: mail scanners open links to
 * inspect them, and a GET that spent the token would leave the person who
 * actually clicked with "already used".
 */
export async function verifyEmailAction(_: LinkFormState, form: FormData): Promise<LinkFormState> {
  try {
    await api.verifyEmail(String(form.get('token') ?? ''))
    return { status: 'verified' }
  } catch (error) {
    return { status: toStatus(error) }
  }
}

function toStatus(error: unknown): LinkStatus {
  if (!(error instanceof ApiError)) return 'unavailable'
  if (error.status === 429) return 'tooMany'
  if (error.status === 400) {
    // A token the API refused says why; a body it could not parse did not get that far.
    const reason = emailTokenFailureSchema.safeParse((error.body as { reason?: unknown } | undefined)?.reason)
    return reason.success ? reason.data : 'invalid'
  }
  return 'unavailable'
}
