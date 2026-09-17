'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { AppShell, Blueprint, Button, Field, Input, Muted, Stack } from '@jobsearch/ui'
import {
  forgotPasswordAction,
  resetPasswordAction,
  verifyEmailAction,
  type LinkFormState,
  type LinkStatus,
} from './link-actions'
import styles from './AuthScreen.module.css'

const FAILURES: LinkStatus[] = ['invalid', 'expired', 'used', 'emailInvalid', 'passwordTooShort', 'tooMany', 'unavailable']

/** The frame every emailed-link page shares: the landing page's chrome, one narrow panel. */
function LinkCard({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  return (
    <AppShell nav={[]} navAside={<LocaleSwitcher className={styles.languageSelect} />} linkComponent={Link} bare>
      <Blueprint as="section" elevation="sm" className={styles.linkPanel}>
        <Stack gap="3">
          <h1 className={styles.linkTitle}>{title}</h1>
          {body ? <Muted as="p">{body}</Muted> : null}
          {children}
        </Stack>
      </Blueprint>
    </AppShell>
  )
}

/** A status sentence: link statuses under `auth.links`, the shared ones under `auth.errors`. */
function useStatusText() {
  const l = useTranslations('auth.links')
  const e = useTranslations('auth.errors')
  return (status: LinkStatus) =>
    status === 'invalid' || status === 'expired' || status === 'used' || status === 'sent' || status === 'verified'
      ? l(status)
      : e(status)
}

function Status({ status }: { status?: LinkStatus }) {
  const text = useStatusText()
  if (!status) return null
  return (
    <p role={FAILURES.includes(status) ? 'alert' : 'status'} className={styles.formError}>
      {text(status)}
    </p>
  )
}

export function ForgotPasswordScreen() {
  const l = useTranslations('auth.links')
  const a = useTranslations('auth')
  const [state, action, pending] = useActionState<LinkFormState, FormData>(forgotPasswordAction, {})
  return (
    <LinkCard title={l('forgotTitle')} body={l('forgotBody')}>
      <form action={action} noValidate>
        <Stack gap="3">
          <Field label={a('email')} htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Status status={state.status} />
          <Button type="submit" variant="primary" block disabled={pending || state.status === 'sent'}>
            {l('sendLink')}
          </Button>
        </Stack>
      </form>
      <Link href="/">{l('backToSignIn')}</Link>
    </LinkCard>
  )
}

export function ResetPasswordScreen({ token }: { token: string | undefined }) {
  const l = useTranslations('auth.links')
  const [state, action, pending] = useActionState<LinkFormState, FormData>(resetPasswordAction, {})
  if (!token) return <MissingToken />

  const spent = state.status === 'invalid' || state.status === 'expired' || state.status === 'used'
  return (
    <LinkCard title={l('resetTitle')} body={l('resetBody')}>
      <form action={action} noValidate>
        <input type="hidden" name="token" value={token} />
        <Stack gap="3">
          <Field label={l('newPassword')} htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
          </Field>
          <Status status={state.status} />
          <Button type="submit" variant="primary" block disabled={pending || spent}>
            {l('savePassword')}
          </Button>
        </Stack>
      </form>
      {/* A spent link cannot be retried; the only way forward is a new one. */}
      {spent ? <Link href="/auth/forgot-password">{l('requestNew')}</Link> : null}
    </LinkCard>
  )
}

export function VerifyEmailScreen({ token }: { token: string | undefined }) {
  const l = useTranslations('auth.links')
  const [state, action, pending] = useActionState<LinkFormState, FormData>(verifyEmailAction, {})
  if (!token) return <MissingToken />

  const done = state.status === 'verified'
  return (
    <LinkCard title={l('verifyTitle')} body={done ? undefined : l('verifyBody')}>
      {done ? null : (
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" variant="primary" block disabled={pending}>
            {l('confirm')}
          </Button>
        </form>
      )}
      <Status status={state.status} />
      <Link href="/feed">{l('goToFeed')}</Link>
    </LinkCard>
  )
}

function MissingToken() {
  const l = useTranslations('auth.links')
  return (
    <LinkCard title={l('invalid')} body={l('missingToken')}>
      <Link href="/">{l('backToSignIn')}</Link>
    </LinkCard>
  )
}
