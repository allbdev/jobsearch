'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import {
  AppShell,
  Blueprint,
  BrandIcon,
  Button,
  Checkbox,
  Cluster,
  EvidenceCard,
  Field,
  Input,
  Muted,
  SegmentedControl,
  Select,
  Stack,
  StatRow,
  Tag,
  toOptions,
  cx,
} from '@jobsearch/ui'
import styles from './AuthScreen.module.css'

type Mode = 'login' | 'register'

const MODE_OPTIONS = [
  { value: 'login', label: 'Sign in' },
  { value: 'register', label: 'Create account' },
] as const

const STATS = [
  { value: '38k', label: 'postings classified' },
  { value: '190+', label: 'countries covered' },
  { value: '0', label: 'broken links tolerated' },
]

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const isLogin = mode === 'login'

  return (
    <AppShell
      nav={[]}
      navAside={
        <LocaleSwitcher className={styles.languageSelect} />
      }
      linkComponent={Link}
      bare
      footer={
        <Cluster
          as="footer"
          justify="space-between"
          className={cx('text-muted', styles.footer)}
        >
          <span>© 2026 JobSearch — geographic eligibility, verified and cited.</span>
          <span>
            <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
          </span>
        </Cluster>
      }
    >
      <div className={styles.layout}>
        <Stack as="section" gap="4" className={styles.hero}>
          <h1 className={styles.headline}>
            Remote jobs you are actually eligible for.
          </h1>
          <Muted as="p" className={styles.lede}>
            Most boards say “Remote”. We verify whether the company hires from <em>your</em> country —
            and quote the line in the posting that proves it. Any profession, one feed, one weekly
            email.
          </Muted>

          <div className={styles.evidence}>
            <EvidenceCard
              variant="framed"
              kicker="Eligibility evidence · example"
              snippet="This role is open to candidates anywhere in Latin America. We hire via Deel."
              footer={
                <Cluster gap="2">
                  <Tag tone="accent">ELIGIBLE · LATAM</Tag>
                  <span className={styles.evidenceNote}>
                    quoted from the posting, link verified today
                  </span>
                </Cluster>
              }
            />
          </div>

          <StatRow stats={STATS} className={styles.stats} />
        </Stack>

        <Blueprint
          as="section"
          elevation="sm"
          className={styles.panel}
        >
          <div className={styles.modeSwitch}>
            <SegmentedControl
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              fill
              ariaLabel="Sign in or create an account"
            />
          </div>

          {!isLogin && (
            <div className={cx(styles.pair, styles.registerFields)}>
              <Field label="Full name" htmlFor="name">
                <Input id="name" placeholder="Ana Souza" />
              </Field>
              <Field label="Country of residence" htmlFor="country">
                <Select
                  id="country"
                  options={toOptions(['Brazil', 'Argentina', 'Mexico', 'Portugal', 'Other…'])}
                />
              </Field>
            </div>
          )}

          <Stack gap="3">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" placeholder="you@example.com" />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              labelAside={
                isLogin ? (
                  <a href="/forgot" className={styles.forgot}>
                    Forgot?
                  </a>
                ) : undefined
              }
            >
              <Input id="password" type="password" placeholder="••••••••" />
            </Field>

            {!isLogin && (
              <Checkbox defaultChecked alignStart>
                Send me the email digest of new matched positions (weekly by default — cadence is
                yours to change)
              </Checkbox>
            )}

            <Button as={Link} variant="primary" block href="/feed" className={styles.submit}>
              {isLogin ? 'Sign in' : 'Create my feed'}
            </Button>

            <Cluster
              gap={10}
              className={cx('text-muted', styles.divider)}
              wrap={false}
            >
              <span className={styles.dividerRule} />
              or
              <span className={styles.dividerRule} />
            </Cluster>

            <div className={styles.oauth}>
              <Button as={Link} variant="secondary" href="/feed">
                <BrandIcon brand="google" />
                Google
              </Button>
              <Button as={Link} variant="secondary" href="/feed">
                <BrandIcon brand="github" />
                GitHub
              </Button>
            </div>

            <Muted as="p" className={styles.swapNote}>
              {isLogin ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setMode(isLogin ? 'register' : 'login')}
                className={styles.swapButton}
              >
                {isLogin ? 'Create an account' : 'Sign in instead'}
              </button>
            </Muted>
          </Stack>
        </Blueprint>
      </div>
    </AppShell>
  )
}
