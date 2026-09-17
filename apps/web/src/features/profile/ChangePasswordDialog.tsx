'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button, Dialog, Field, Input, Stack } from '@jobsearch/ui'
import { changePasswordAction, type PasswordFormState } from './password-actions'

const FORM_ID = 'change-password'

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('profile.password')
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(changePasswordAction, {})
  const done = state.outcome === 'done'

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('title')}
      actions={
        done ? (
          <Button variant="primary" onClick={onClose}>
            {t('close')}
          </Button>
        ) : (
          // Outside the <form> in the dialog's footer, so tied to it by id.
          <Button type="submit" form={FORM_ID} variant="primary" disabled={pending}>
            {t('submit')}
          </Button>
        )
      }
    >
      {done ? (
        <p role="status">{t('done')}</p>
      ) : (
        <form id={FORM_ID} action={action} noValidate>
          <Stack gap="3">
            <Field label={t('current')} htmlFor="current-password">
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={state.outcome === 'wrong_password'}
                required
              />
            </Field>
            <Field label={t('new')} htmlFor="new-password" hint={t('newHint')}>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={state.outcome === 'passwordTooShort'}
                required
              />
            </Field>
            {state.outcome ? <p role="alert">{t(state.outcome)}</p> : null}
            {/* No password to change: setting a first one goes through email (#68). */}
            {state.outcome === 'no_password' ? <Link href="/auth/forgot-password">{t('sendLink')}</Link> : null}
          </Stack>
        </form>
      )}
    </Dialog>
  )
}
