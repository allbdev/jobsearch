'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import type { Account } from '@jobsearch/shared'
import { DELETE_ACCOUNT_CONFIRMATION } from '@jobsearch/shared'
import { Button, Dialog, Field, Input, Stack } from '@jobsearch/ui'
import { deleteAccountAction, type AccountActionResult } from './account-actions'
import styles from './ProfileScreen.module.css'

const FORM_ID = 'delete-account'

/** Irreversible, so it asks for the password — or, with no password, for the word. */
export function DeleteAccountDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const t = useTranslations('profile.account')
  const [state, action, pending] = useActionState<AccountActionResult, FormData>(deleteAccountAction, { ok: false })

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('deleteTitle')}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={pending} className={styles.dangerAction}>
            {t('deleteConfirm')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} action={action} noValidate>
        <Stack gap="3">
          <p>{t('deleteBody')}</p>
          {account.hasPassword ? (
            <Field label={t('deletePassword')} htmlFor="delete-password">
              <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
            </Field>
          ) : (
            <Field
              label={t('deleteTypeWord', { word: DELETE_ACCOUNT_CONFIRMATION })}
              htmlFor="delete-confirm"
              hint={t('deleteTypeHint')}
            >
              <Input id="delete-confirm" name="confirm" autoComplete="off" required />
            </Field>
          )}
          {state.outcome ? (
            <p role="alert" className={styles.saveStatus}>
              {t(state.outcome)}
            </p>
          ) : null}
        </Stack>
      </form>
    </Dialog>
  )
}
