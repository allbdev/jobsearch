'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { AppShell, Blueprint, Button, Muted, Stack } from '@jobsearch/ui'
import { unsubscribeAction, type UnsubscribeState } from './unsubscribe-actions'
import styles from '../auth/AuthScreen.module.css'

/**
 * Behind a button, not on page load: mail scanners open links to inspect them,
 * and a GET that unsubscribed would turn one of those into a cancelled
 * subscription the reader never asked for. Same reasoning as email
 * verification (#62).
 */
export function UnsubscribeScreen({ token }: { token: string | undefined }) {
  const t = useTranslations('digest')
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeAction, {})
  const done = state.outcome === 'done'

  return (
    <AppShell nav={[]} navAside={<LocaleSwitcher className={styles.languageSelect} />} linkComponent={Link} bare>
      <Blueprint as="section" elevation="sm" className={styles.linkPanel}>
        <Stack gap="3">
          <h1 className={styles.linkTitle}>{t('title')}</h1>
          {!token ? (
            <Muted as="p">{t('missing')}</Muted>
          ) : done ? (
            <p role="status">{t('done')}</p>
          ) : (
            <>
              <Muted as="p">{t('body')}</Muted>
              <form action={action}>
                <input type="hidden" name="token" value={token} />
                <Button type="submit" variant="primary" block disabled={pending}>
                  {t('confirm')}
                </Button>
              </form>
              {state.outcome ? (
                <p role="alert" className={styles.formError}>
                  {t(state.outcome)}
                </p>
              ) : null}
            </>
          )}
          <Link href="/profile#digest">{t('toProfile')}</Link>
        </Stack>
      </Blueprint>
    </AppShell>
  )
}
