'use server'

import type { Profile } from '@jobsearch/shared'
import { profileInputSchema } from '@jobsearch/shared'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'unavailable'; fields?: string[] }

/**
 * Saves the whole profile. `email` is dropped rather than sent: it belongs to
 * the account, and the API does not accept it here (#61).
 */
export async function saveProfileAction({ email: _email, ...profile }: Profile): Promise<ProfileActionResult> {
  const parsed = profileInputSchema.safeParse(profile)
  if (!parsed.success) {
    return { ok: false, error: 'invalid', fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] }
  }
  try {
    await api.saveProfile(parsed.data)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof ApiError && error.status === 400 ? 'invalid' : 'unavailable' }
  }
}
