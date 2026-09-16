'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AppShell, Blueprint, Muted, SignOutButton } from '@jobsearch/ui'
import styles from './FeedScreen.module.css'

/** A signed-in user with no saved feed: the normal first state of an account, not an error. */
export function NoFeeds() {
  const t = useTranslations('nav')
  const f = useTranslations('feed')
  return (
    <AppShell
      nav={[
        { href: '/feed', label: t('feed'), current: true },
        { href: '/profile', label: t('profile') },
      ]}
      navAside={<SignOutButton action="/api/sign-out" />}
      linkComponent={Link}
    >
      <Blueprint className={styles.empty}>
        <h2 className={styles.title}>{f('noFeedsTitle')}</h2>
        <Muted as="p">{f('noFeedsBody')}</Muted>
      </Blueprint>
    </AppShell>
  )
}
