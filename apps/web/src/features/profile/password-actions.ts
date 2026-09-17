'use server'

import { changePasswordRequestSchema } from '@jobsearch/shared'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'

/** Keys under `profile.password`. */
export type PasswordOutcome =
  | 'done'
  | 'wrong_password'
  | 'no_password'
  | 'passwordTooShort'
  | 'required'
  | 'tooMany'
  | 'unavailable'

export interface PasswordFormState {
  outcome?: PasswordOutcome
}

export async function changePasswordAction(_: PasswordFormState, form: FormData): Promise<PasswordFormState> {
  const parsed = changePasswordRequestSchema.safeParse({
    currentPassword: String(form.get('currentPassword') ?? ''),
    newPassword: String(form.get('newPassword') ?? ''),
  })
  if (!parsed.success) {
    // A missing field first: "too short" is no help to someone who typed nothing.
    const empty = !form.get('currentPassword') || !form.get('newPassword')
    return { outcome: empty ? 'required' : 'passwordTooShort' }
  }

  try {
    await api.changePassword(parsed.data)
    return { outcome: 'done' }
  } catch (error) {
    if (!(error instanceof ApiError)) return { outcome: 'unavailable' }
    if (error.status === 429) return { outcome: 'tooMany' }
    const reason = (error.body as { reason?: string } | undefined)?.reason
    if (reason === 'wrong_password' || reason === 'no_password') return { outcome: reason }
    return { outcome: error.status === 400 ? 'passwordTooShort' : 'unavailable' }
  }
}
