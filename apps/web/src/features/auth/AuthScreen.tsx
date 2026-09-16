'use client'

import { useActionState, useState } from 'react'
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
import { registerAction, signInAction, type AuthFormState } from './actions'
import styles from './AuthScreen.module.css'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const isLogin = mode === 'login'
  const a = useTranslations('auth')

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
          <AuthForm key={mode} isLogin={isLogin} />

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

function AuthForm({ isLogin }: { isLogin: boolean }) {
  const a = useTranslations('auth')
  const e = useTranslations('auth.errors')
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    isLogin ? signInAction : registerAction,
    {},
  )
  const fieldError = (key: 'email' | 'password' | 'name') => {
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
          <Field label={a('residence')} htmlFor="country">
            <Select
              id="country"
              name="residence"
              options={toOptions(['Brazil', 'Argentina', 'Mexico', 'Portugal', 'Other…'])}
            />
          </Field>
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
              <a href="/forgot" className={styles.forgot}>
                {a('forgot')}
              </a>
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
