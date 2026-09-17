'use client'

import { useState, useTransition } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import type { Account, OAuthProvider } from '@jobsearch/shared'
import { Button, Cluster, Dialog, Muted, Stack } from '@jobsearch/ui'
import { unlinkConnectionAction, type AccountOutcome } from './account-actions'
import styles from './ProfileScreen.module.css'

const PROVIDERS: { id: OAuthProvider; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'github', name: 'GitHub' },
]

export function ConnectedAccountsDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const t = useTranslations('profile.account')
  const format = useFormatter()
  const locale = useLocale()
  const [outcome, setOutcome] = useState<AccountOutcome | null>(null)
  const [pending, startUnlinking] = useTransition()

  const linked = (provider: OAuthProvider) => account.connections.find((row) => row.provider === provider)
  // Unlinking the only credential would lock this account out for good, and the
  // API refuses it (#79). Saying so here is better than offering a button that
  // returns an error.
  const onlyWayIn = (provider: OAuthProvider) =>
    !account.hasPassword && account.connections.length === 1 && Boolean(linked(provider))

  return (
    <Dialog open onClose={onClose} title={t('connectionsTitle')} actions={<Button onClick={onClose}>{t('close')}</Button>}>
      <Stack gap="3">
        <Muted as="p">{t('connectionsBody')}</Muted>
        {PROVIDERS.map(({ id, name }) => {
          const connection = linked(id)
          return (
            <Cluster key={id} justify="space-between" align="center" gap="3">
              <span>
                {name}
                {connection ? (
                  <Muted className={styles.connectionSince}>
                    {' · '}
                    {t('linkedOn', { date: format.dateTime(new Date(connection.linkedAt), { dateStyle: 'medium' }) })}
                  </Muted>
                ) : null}
              </span>
              {connection ? (
                <Button
                  variant="secondary"
                  disabled={pending || onlyWayIn(id)}
                  title={onlyWayIn(id) ? t('last_way_in') : undefined}
                  onClick={() => startUnlinking(async () => setOutcome((await unlinkConnectionAction(id)).outcome ?? null))}
                >
                  {t('unlink')}
                </Button>
              ) : (
                // A full page load: the start route answers with a redirect to
                // the provider (#63).
                <Button as="a" variant="secondary" href={`/api/oauth/${id}?locale=${locale}`}>
                  {t('connect')}
                </Button>
              )}
            </Cluster>
          )
        })}
        {outcome ? (
          <p role={outcome === 'unlinked' ? 'status' : 'alert'} className={styles.saveStatus}>
            {t(outcome)}
          </p>
        ) : null}
        {!account.hasPassword ? <Muted as="p">{t('noPasswordNote')}</Muted> : null}
      </Stack>
    </Dialog>
  )
}
