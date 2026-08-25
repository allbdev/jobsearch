'use client'

import { useState } from 'react'
import Link from 'next/link'
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
} from '@jobsearch/ui'
import { color, hairline } from '@jobsearch/design-system/tokens'

type Mode = 'login' | 'register'

const MODE_OPTIONS = [
  { value: 'login', label: 'Sign in' },
  { value: 'register', label: 'Create account' },
] as const

const LANGUAGES = ['English', 'Português (BR)', 'Español']

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
        <Select
          aria-label="Language"
          options={toOptions(LANGUAGES)}
          defaultValue="English"
          style={{ width: 'auto', minHeight: 30, padding: '3px 8px', fontSize: 13 }}
        />
      }
      linkComponent={Link}
      bare
      footer={
        <Cluster
          as="footer"
          justify="space-between"
          className="text-muted"
          style={{
            borderTop: hairline,
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 12,
          }}
        >
          <span>© 2026 JobSearch — geographic eligibility, verified and cited.</span>
          <span>
            <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
          </span>
        </Cluster>
      }
    >
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 'var(--space-8)',
          maxWidth: 1080,
          width: '100%',
          margin: '0 auto',
          padding: 'var(--space-8) var(--space-4)',
          alignItems: 'center',
        }}
      >
        <Stack as="section" gap="4">
          <h1 style={{ fontSize: 52, maxWidth: '9em', textWrap: 'pretty', margin: 0 }}>
            Remote jobs you are actually eligible for.
          </h1>
          <Muted as="p" style={{ fontSize: 16, maxWidth: '34em', margin: 0 }}>
            Most boards say “Remote”. We verify whether the company hires from <em>your</em> country —
            and quote the line in the posting that proves it. Any profession, one feed, one weekly
            email.
          </Muted>

          <div style={{ maxWidth: 440 }}>
            <EvidenceCard
              variant="framed"
              kicker="Eligibility evidence · example"
              snippet="This role is open to candidates anywhere in Latin America. We hire via Deel."
              footer={
                <Cluster gap="2">
                  <Tag tone="accent">ELIGIBLE · LATAM</Tag>
                  <span>quoted from the posting, link verified today</span>
                </Cluster>
              }
            />
          </div>

          <StatRow stats={STATS} />
        </Stack>

        <Blueprint
          as="section"
          elevation="sm"
          style={{
            padding: 'var(--space-6)',
            background: 'transparent',
            maxWidth: 420,
            width: '100%',
            justifySelf: 'center',
          }}
        >
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <SegmentedControl
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              fill
              ariaLabel="Sign in or create an account"
            />
          </div>

          {!isLogin && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-3)',
              }}
            >
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
                  <a href="/forgot" style={{ fontSize: 12 }}>
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

            <Button as={Link} variant="primary" block href="/feed" style={{ marginTop: 0 }}>
              {isLogin ? 'Sign in' : 'Create my feed'}
            </Button>

            <Cluster
              gap={10}
              className="text-muted"
              style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              wrap={false}
            >
              <span style={{ flex: 1, height: 1, background: color.divider }} />
              or
              <span style={{ flex: 1, height: 1, background: color.divider }} />
            </Cluster>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <Button as={Link} variant="secondary" href="/feed">
                <BrandIcon brand="google" />
                Google
              </Button>
              <Button as={Link} variant="secondary" href="/feed">
                <BrandIcon brand="github" />
                GitHub
              </Button>
            </div>

            <Muted as="p" style={{ margin: 'var(--space-2) 0 0', fontSize: 12, textAlign: 'center' }}>
              {isLogin ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setMode(isLogin ? 'register' : 'login')}
                style={{
                  font: 'inherit',
                  background: 'none',
                  border: 'none',
                  color: color.accent,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
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
