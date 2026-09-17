'use client'

import { Suspense, useActionState, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
  cx,
} from '@jobsearch/ui'
import { registerAction, signInAction, type AuthFormState } from './actions'
import { OAuthNotice } from './OAuthNotice'
import type { Option } from '../profile/profile-options'
import styles from './AuthScreen.module.css'

type Mode = 'login' | 'register'

export function AuthScreen({ countries }: { countries: Option[] }) {
  const [mode, setMode] = useState<Mode>('login')
  const isLogin = mode === 'login'
  const a = useTranslations('auth')
  const locale = useLocale()

  const modeOptions = [
    { value: 'login', label: a('signIn') },
    { value: 'register', label: a('createAccount') },
  ] as const

  const stats = [
    { value: '38k', label: a('statClassified') },
    { value: '190+', label: a('statCountries') },
    { value: '0', label: a('statBrokenLinks') },
  ]

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
          {/* The year differs between a prerendered build and a client render
              once January arrives, which React reports as a hydration error
              until the next deploy. The text is cosmetic, so the warning is
              suppressed rather than freezing the year at build time. */}
          <span suppressHydrationWarning>
            {a('copyright', { year: new Date().getFullYear() })}
          </span>
          <span>
            <a href="/privacy">{a('privacy')}</a> · <a href="/terms">{a('terms')}</a>
          </span>
        </Cluster>
      }
    >
      <div className={styles.layout}>
        <Stack as="section" gap="4" className={styles.hero}>
          <h1 className={styles.headline}>{a('headline')}</h1>
          <Muted as="p" className={styles.lede}>
            {a.rich('lede', { em: (chunks) => <em>{chunks}</em> })}
          </Muted>

          <div className={styles.evidence}>
            <EvidenceCard
              variant="framed"
              kicker={a('exampleKicker')}
              snippet={a('exampleQuote')}
              footer={
                <Cluster gap="2">
                  <Tag tone="accent">{a('exampleBadge')}</Tag>
                  <span className={styles.evidenceNote}>{a('exampleNote')}</span>
                </Cluster>
              }
            />
          </div>

          <StatRow stats={stats} className={styles.stats} />
        </Stack>

        <Blueprint
          as="section"
          elevation="sm"
          className={styles.panel}
        >
          <div className={styles.modeSwitch}>
            <SegmentedControl
              options={modeOptions}
              value={mode}
              onChange={setMode}
              fill
              ariaLabel={a('signIn')}
            />
          </div>

          {/* Keyed by mode, so switching tabs starts from a clean form and state. */}
          <AuthForm key={mode} isLogin={isLogin} countries={countries} />

          <Stack gap="3" className={styles.alternatives}>
            <Cluster
              gap={10}
              className={cx('text-muted', styles.divider)}
              wrap={false}
            >
              <span className={styles.dividerRule} />
              {a('or')}
              <span className={styles.dividerRule} />
            </Cluster>

            {/* Plain links, not client navigation: the start route answers
                with a redirect to another site. */}
            <div className={styles.oauth}>
              <Button as="a" variant="secondary" href={`/api/oauth/google?locale=${locale}`}>
                <BrandIcon brand="google" />
                Google
              </Button>
              <Button as="a" variant="secondary" href={`/api/oauth/github?locale=${locale}`}>
                <BrandIcon brand="github" />
                GitHub
              </Button>
            </div>

            {/* Reads the query string, so it cannot be part of the prerendered page. */}
            <Suspense fallback={null}>
              <OAuthNotice />
            </Suspense>

            <Muted as="p" className={styles.swapNote}>
              {isLogin ? a('newHere') : a('haveAccount')}{' '}
              <button
                type="button"
                onClick={() => setMode(isLogin ? 'register' : 'login')}
                className={styles.swapButton}
              >
                {isLogin ? a('goCreate') : a('goSignIn')}
              </button>
            </Muted>
          </Stack>
        </Blueprint>
      </div>
    </AppShell>
  )
}

function AuthForm({ isLogin, countries }: { isLogin: boolean; countries: Option[] }) {
  const a = useTranslations('auth')
  const e = useTranslations('auth.errors')
  // Read after mount: the server that prerendered this page has no idea where
  // the reader is, and guessing there would mismatch on hydration.
  const [timezone, setTimezone] = useState('UTC')
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), [])
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    isLogin ? signInAction : registerAction,
    {},
  )
  const fieldError = (key: 'email' | 'password' | 'name' | 'residence') => {
    const error = state.fields?.[key]
    return error ? <span role="alert">{e(error)}</span> : undefined
  }

  return (
    <form action={formAction} noValidate className={styles.form}>
      {!isLogin && (
        <div className={cx(styles.pair, styles.registerFields)}>
          <Field label={a('fullName')} htmlFor="name" hint={fieldError('name')}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              defaultValue={state.values?.name}
              placeholder={a('fullNamePlaceholder')}
            />
          </Field>
          <Field label={a('residence')} htmlFor="country" hint={fieldError('residence')}>
            <Select
              // Remounted when the echoed country changes. React re-applies an
              // input's defaultValue after a form action resets the form, but a
              // select's default is fixed when it mounts -- so without this a
              // refused registration loses the chosen country (and making it
              // controlled does not help: the reset happens under React).
              key={state.values?.residence ?? ''}
              id="country"
              name="residence"
              required
              aria-invalid={Boolean(state.fields?.residence)}
              defaultValue={state.values?.residence ?? ''}
              options={[{ value: '', label: a('chooseCountry') }, ...countries]}
            />
          </Field>
          <input type="hidden" name="timezone" value={timezone} />
        </div>
      )}

      <Stack gap="3">
        <Field label={a('email')} htmlFor="email" hint={fieldError('email')}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
            aria-invalid={Boolean(state.fields?.email)}
            placeholder={a('emailPlaceholder')}
          />
        </Field>
        <Field
          label={a('password')}
          htmlFor="password"
          hint={fieldError('password')}
          labelAside={
            isLogin ? (
              <Link href="/auth/forgot-password" className={styles.forgot}>
                {a('forgot')}
              </Link>
            ) : undefined
          }
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            aria-invalid={Boolean(state.fields?.password)}
            placeholder="••••••••"
          />
        </Field>

        {!isLogin && (
          <Checkbox name="digest" defaultChecked alignStart>
            {a('digestOptIn')}
          </Checkbox>
        )}

        {state.error ? (
          <p role="alert" className={styles.formError}>
            {e(state.error)}
          </p>
        ) : null}

        <Button type="submit" variant="primary" block disabled={pending} className={styles.submit}>
          {isLogin ? a('ctaSignIn') : a('ctaCreate')}
        </Button>
      </Stack>
    </form>
  )
}
