'use server'

import { getLocale } from 'next-intl/server'
import type { z } from 'zod'
import { loginRequestSchema, registerRequestSchema } from '@jobsearch/shared'
import { redirect } from '@/i18n/navigation'
import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'
import { setSession } from '@/server/session'

/** Message keys under `auth.errors`; the form renders them in the page's language. */
export type AuthError =
  | 'invalidCredentials'
  | 'emailTaken'
  | 'tooMany'
  | 'unavailable'
  | 'emailInvalid'
  | 'passwordTooShort'
  | 'required'

export interface AuthFormState {
  error?: AuthError
  fields?: Partial<Record<'email' | 'password' | 'name', AuthError>>
  /** Echoed back: React resets a form after its action runs, and retyping an email is a bad reason to give up. */
  values?: { email: string; name: string }
}

export async function signInAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  return authenticate(form, loginRequestSchema, api.signIn)
}

export async function registerAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  // Residence and the digest opt-in are on the form but not sent: the API has
  // nowhere to keep them until profiles can be created.
  return authenticate(form, registerRequestSchema, api.register)
}

async function authenticate<S extends z.ZodTypeAny>(
  form: FormData,
  schema: S,
  call: (input: z.output<S>) => Promise<unknown>,
): Promise<AuthFormState> {
  const text = (key: string) => String(form.get(key) ?? '')
  const values = { email: text('email'), name: text('name') }
  const input = { email: values.email, password: text('password'), name: values.name.trim() || undefined }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values }

  let session: Awaited<ReturnType<typeof api.signIn>>
  try {
    session = (await call(parsed.data)) as typeof session
  } catch (error) {
    return { error: toAuthError(error), values }
  }

  await setSession(session)
  // Outside the try: `redirect` works by throwing, and a catch would swallow it.
  redirect({ href: '/feed', locale: await getLocale() })
  return {}
}

function fieldErrors(error: z.ZodError): AuthFormState['fields'] {
  const fields: NonNullable<AuthFormState['fields']> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (key !== 'email' && key !== 'password' && key !== 'name') continue
    fields[key] ??=
      key === 'email' ? 'emailInvalid' : key === 'password' && issue.code === 'too_small' && issue.minimum !== 1 ? 'passwordTooShort' : 'required'
  }
  return fields
}

function toAuthError(error: unknown): AuthError {
  if (!(error instanceof ApiError)) return 'unavailable'
  if (error.status === 401) return 'invalidCredentials'
  if (error.status === 409) return 'emailTaken'
  if (error.status === 429) return 'tooMany'
  return 'unavailable'
}
