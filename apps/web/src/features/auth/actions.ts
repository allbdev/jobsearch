'use server'

import { getLocale } from 'next-intl/server'
import type { z } from 'zod'
import { loginRequestSchema, profileInputSchema, registerRequestSchema } from '@jobsearch/shared'
import { firstProfile } from '@/features/profile/first-profile'
import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
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
  | 'residenceRequired'

export interface AuthFormState {
  error?: AuthError
  fields?: Partial<Record<'email' | 'password' | 'name' | 'residence', AuthError>>
  /** Echoed back: React resets a form after its action runs, and retyping an email is a bad reason to give up. */
  values?: { email: string; name: string; residence?: string }
}

export async function signInAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  return authenticate(form, loginRequestSchema, api.signIn)
}

/**
 * Creates the account, then saves the profile the sign-up form collected:
 * residence (required -- it decides which jobs this person can take), the
 * browser's time zone, the page's language and the digest opt-in.
 *
 * If the account is created but the profile is not, the person is signed in
 * and sent to finish it on the profile screen rather than told registration
 * failed -- it did not.
 */
export async function registerAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const residence = String(form.get('residence') ?? '')
  if (!/^[A-Z]{2}$/.test(residence)) {
    // Every problem at once, not residence first and the rest on the next try.
    const account = registerRequestSchema.safeParse(accountInput(form))
    return {
      fields: { ...(account.success ? {} : fieldErrors(account.error)), residence: 'residenceRequired' },
      values: echo(form),
    }
  }

  return authenticate(form, registerRequestSchema, api.register, async () => {
    const answers = {
      locale: (await getLocale()) as Locale,
      residenceCountry: residence,
      digest: form.get('digest') === 'on',
    }
    // The browser's time zone, unless this server does not recognise it -- then UTC,
    // rather than losing the residence along with it.
    const withZone = profileInputSchema.safeParse(firstProfile({ ...answers, timezone: String(form.get('timezone') ?? '') }))
    const profile = withZone.success ? withZone.data : profileInputSchema.parse(firstProfile(answers))
    try {
      await api.saveProfile(profile)
      return '/feed'
    } catch {
      return '/profile'
    }
  })
}

async function authenticate<S extends z.ZodTypeAny>(
  form: FormData,
  schema: S,
  call: (input: z.output<S>) => Promise<unknown>,
  /** Runs once signed in; returns where to go next. */
  afterSignIn: () => Promise<string> = async () => '/feed',
): Promise<AuthFormState> {
  const values = echo(form)
  const parsed = schema.safeParse(accountInput(form))
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values }

  let session: Awaited<ReturnType<typeof api.signIn>>
  try {
    session = (await call(parsed.data)) as typeof session
  } catch (error) {
    return { error: toAuthError(error), values }
  }

  await setSession(session)
  const next = await afterSignIn()
  // Outside the try: `redirect` works by throwing, and a catch would swallow it.
  redirect({ href: next, locale: await getLocale() })
  return {}
}

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function accountInput(form: FormData) {
  return { email: text(form, 'email'), password: text(form, 'password'), name: text(form, 'name').trim() || undefined }
}

/** What goes back into the form after a refusal. Never the password. */
function echo(form: FormData): NonNullable<AuthFormState['values']> {
  return { email: text(form, 'email'), name: text(form, 'name'), residence: text(form, 'residence') }
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
