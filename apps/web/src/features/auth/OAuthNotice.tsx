'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import styles from './AuthScreen.module.css'

const OUTCOMES = ['cancelled', 'failed', 'email_unverified', 'unavailable', 'tooMany'] as const
type Outcome = (typeof OUTCOMES)[number]

/** Why a Google or GitHub sign-in came back here instead of to the feed. */
export function OAuthNotice() {
  const t = useTranslations('auth.oauth')
  const outcome = useSearchParams().get('oauth')
  if (!OUTCOMES.includes(outcome as Outcome)) return null
  return (
    <p role="alert" className={styles.formError}>
      {t(outcome as Outcome)}
    </p>
  )
}
