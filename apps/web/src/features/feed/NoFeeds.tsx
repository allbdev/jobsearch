'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AppShell, Blueprint, Button, Icon, Muted, Plus, SignOutButton } from '@jobsearch/ui'
import { BLANK_FEED, FeedDefinitionDialog } from './FeedDefinitionDialog'
import styles from './FeedScreen.module.css'

/** A signed-in user with no saved feed: the normal first state of an account, not an error. */
export function NoFeeds() {
  const t = useTranslations('nav')
  const f = useTranslations('feed')
  const [creating, setCreating] = useState(false)
  return (
    <AppShell
      nav={[
        { href: '/feed', label: t('feed'), current: true },
        { href: '/profile', label: t('profile') },
      ]}
      navAside={<SignOutButton action="/api/sign-out" label={t('signOut')} />}
      linkComponent={Link}
    >
      <Blueprint className={styles.empty}>
        <h2 className={styles.title}>{f('noFeedsTitle')}</h2>
        <Muted as="p">{f('noFeedsBody')}</Muted>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Icon icon={Plus} />
          {f('createFirstFeed')}
        </Button>
      </Blueprint>
      {creating ? (
        <FeedDefinitionDialog open onClose={() => setCreating(false)} definition={BLANK_FEED} feedId={null} />
      ) : null}
    </AppShell>
  )
}
