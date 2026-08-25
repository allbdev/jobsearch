'use client'

import { useState } from 'react'
import Link from 'next/link'
import type {
  ContractModel,
  DigestCadence,
  HistoryEntry,
  JobInteraction,
  Profile,
  Seniority,
} from '@jobsearch/shared'
import {
  SENIORITY_LABELS,
  TARGET_REGIONS,
  WORK_LANGUAGES,
  JOB_FAMILIES,
  chipOptions,
  contractOptions,
} from '@jobsearch/shared'
import {
  AppShell,
  Button,
  ChevronLeft,
  ChipToggleGroup,
  Cluster,
  CompensationField,
  DataTable,
  EligibilityBadge,
  Field,
  Input,
  Icon,
  ScrollRow,
  SectionCard,
  SegmentedControl,
  Select,
  SignOutButton,
  SkillsInput,
  Stack,
  Tag,
  toOptions,
  toggleInList,
  cx,
  type Column,
} from '@jobsearch/ui'
import styles from './ProfileScreen.module.css'

/** id, desktop label, mobile chip label. */
const SETTINGS_NAV = [
  ['profile', 'Profile & matching', 'Matching'],
  ['occupation', 'Occupation & skills', 'Occupation'],
  ['contract', 'Contract & compensation', 'Contract'],
  ['digest', 'Email digest', 'Digest'],
  ['account', 'Account & security', 'Account'],
  ['history', 'Job history', 'History'],
] as const

const SENIORITY_OPTIONS = (Object.keys(SENIORITY_LABELS) as Seniority[]).map((value) => ({
  value,
  label: SENIORITY_LABELS[value],
}))

const CADENCE_OPTIONS: { value: DigestCadence; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'off', label: 'Off' },
]

const HISTORY_TABS: { value: JobInteraction; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'dismissed', label: 'Dismissed' },
]

export function ProfileScreen({ profile, history }: { profile: Profile; history: HistoryEntry[] }) {
  const [draft, setDraft] = useState(profile)
  const [amount, setAmount] = useState(
    profile.minCompensation ? profile.minCompensation.toLocaleString('en-US') : '',
  )
  const [historyTab, setHistoryTab] = useState<JobInteraction>('saved')

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const columns: Column<HistoryEntry>[] = [
    {
      key: 'title',
      header: 'Position',
      mobileArea: 'title',
      render: (row) => (
        <span className={styles.jobTitle}>
          {row.title}
        </span>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      mobileArea: 'company',
      render: (row) => <span className="text-muted">{row.company}</span>,
    },
    {
      key: 'eligibility',
      header: 'Eligibility',
      mobileArea: 'eligibility',
      render: (row) => (
        <EligibilityBadge
          verdict={row.confirmed ? 'confirmed' : 'needs_check'}
          regionLabel={row.regionLabel}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      // Dropped from the mobile card: the selected tab already states it.
      hideOnMobile: true,
      render: (row) => <Tag tone="neutral">{row.status}</Tag>,
    },
    {
      key: 'date',
      header: 'Date',
      align: 'right',
      mobileArea: 'date',
      render: (row) => <span className="text-muted">{row.date}</span>,
    },
  ]

  return (
    <AppShell
      nav={[
        { href: '/feed', label: 'Feed' },
        { href: '/profile', label: 'Profile', current: true },
      ]}
      navAside={<SignOutButton href="/" linkComponent={Link} />}
      linkComponent={Link}
      bare
      mobileHeader={
        <>
          <div className={cx('nav', styles.mobileHeader)}>
            <div className={cx('nav-brand', styles.mobileTitle)}>Profile</div>
            <SignOutButton href="/" linkComponent={Link} />
          </div>
          <ScrollRow className={styles.sectionChips}>
            {SETTINGS_NAV.map(([id, label, shortLabel]) => (
              <Tag key={id} as="a" href={`#${id}`} tone="neutral" className={styles.sectionChip}>
                {shortLabel}
              </Tag>
            ))}
          </ScrollRow>
        </>
      }
    >
      <div
        className={styles.layout}
      >
        <Stack as="aside" gap="1" className={styles.nav}>
          <h6 className={styles.navHeading}>Settings</h6>
          {SETTINGS_NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={styles.navLink}>
              {label}
            </a>
          ))}
        </Stack>

        <Stack as="main" gap="8" className={styles.main}>
          <SectionCard
            id="profile"
            title="Profile & matching"
            description="Where you live decides which postings you are eligible for. Everything else tunes relevance, never blocks a match."
          >
            <div className={styles.pair}>
              <Field label="Country of residence" htmlFor="residence">
                <Select
                  id="residence"
                  options={toOptions(['Brazil', 'Argentina', 'Mexico', 'Portugal'])}
                  value={draft.residenceCountry}
                  onChange={(event) => update('residenceCountry', event.target.value)}
                />
              </Field>
              <Field label="Timezone" htmlFor="timezone">
                <Select
                  id="timezone"
                  options={toOptions(['UTC−3 · Brasília', 'UTC−5 · Bogotá', 'UTC+0 · Lisbon'])}
                  value={draft.timezone}
                  onChange={(event) => update('timezone', event.target.value)}
                />
              </Field>
            </div>

            <Field label="Target regions — companies hiring from">
              <ChipToggleGroup
                options={chipOptions(TARGET_REGIONS)}
                selected={draft.targetRegions}
                onToggle={(value) => update('targetRegions', toggleInList(draft.targetRegions, value))}
                ariaLabel="Target regions"
              />
            </Field>

            <Field
              label="Languages you work in"
              hint="Postings in these languages appear in your feed. Timezone overlap requirements never block a match — only residence does."
            >
              <ChipToggleGroup
                options={chipOptions(WORK_LANGUAGES)}
                selected={draft.languages}
                onToggle={(value) => update('languages', toggleInList(draft.languages, value))}
                ariaLabel="Languages"
              />
            </Field>
          </SectionCard>

          <SectionCard
            id="occupation"
            title="Occupation & skills"
            description="Any profession — pick your families, then the roles and skills that describe you."
          >
            <Field label="Job families">
              <ChipToggleGroup
                options={chipOptions(JOB_FAMILIES)}
                selected={draft.jobFamilies}
                onToggle={(value) => update('jobFamilies', toggleInList(draft.jobFamilies, value))}
                ariaLabel="Job families"
              />
            </Field>

            <div
              className={styles.pair}
            >
              <Field label="Target roles" htmlFor="roles">
                <Input
                  id="roles"
                  value={draft.targetRoles}
                  onChange={(event) => update('targetRoles', event.target.value)}
                />
              </Field>
              <Field label="Seniority">
                <SegmentedControl
                  fillMobile
                  options={SENIORITY_OPTIONS}
                  value={draft.seniority}
                  onChange={(value) => update('seniority', value)}
                  ariaLabel="Seniority"
                />
              </Field>
            </div>

            <Field label="Skills" hint="Free text is fine — matching is semantic, not exact-tag.">
              <SkillsInput skills={draft.skills} onChange={(skills) => update('skills', skills)} />
            </Field>
          </SectionCard>

          <SectionCard
            id="contract"
            title="Contract & compensation"
            description="How you can be hired from your country."
          >
            <Field label="Accepted contract models">
              <ChipToggleGroup<ContractModel>
                options={contractOptions}
                selected={draft.contractModels}
                onToggle={(value) => update('contractModels', toggleInList(draft.contractModels, value))}
                ariaLabel="Contract models"
              />
            </Field>
            <CompensationField
              amount={amount}
              currency={draft.currency}
              onAmountChange={setAmount}
              onCurrencyChange={(value) => update('currency', value)}
              maxWidth={420}
            />
          </SectionCard>

          <SectionCard
            id="digest"
            title="Email digest"
            description="New matched positions, delivered in your timezone. One-click unsubscribe in every email."
          >
            <Cluster gap="4" align="flex-end" className={styles.digestRow}>
              <Field label="Cadence">
                <SegmentedControl
                  fillMobile
                  options={CADENCE_OPTIONS}
                  value={draft.digest.cadence}
                  onChange={(cadence) => update('digest', { ...draft.digest, cadence })}
                  ariaLabel="Digest cadence"
                />
              </Field>
              <Field label="Send on" htmlFor="send-on">
                <Select
                  id="send-on"
                  className={styles.sendOn}
                  options={toOptions(['Monday', 'Wednesday', 'Friday'])}
                  value={draft.digest.sendOn}
                  onChange={(event) => update('digest', { ...draft.digest, sendOn: event.target.value })}
                />
              </Field>
              <Field label="At" htmlFor="send-at">
                <Select
                  id="send-at"
                  className={styles.sendAt}
                  options={toOptions(['08:00', '12:00', '18:00'])}
                  value={draft.digest.sendAt}
                  onChange={(event) => update('digest', { ...draft.digest, sendAt: event.target.value })}
                />
              </Field>
            </Cluster>
            <div className={styles.emailLanguage}>
              <Field label="Email language" htmlFor="digest-lang">
                <Select
                  id="digest-lang"
                  options={toOptions(['English', 'Português (BR)', 'Español'])}
                  value={draft.digest.language}
                  onChange={(event) => update('digest', { ...draft.digest, language: event.target.value })}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard id="account" title="Account & security">
            <div
              className={cx(styles.pair, styles.pairNarrow)}
            >
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => update('email', event.target.value)}
                />
              </Field>
              <Field label="Interface language" htmlFor="ui-lang">
                <Select
                  id="ui-lang"
                  options={toOptions(['English', 'Português (BR)', 'Español'])}
                  value={draft.interfaceLanguage}
                  onChange={(event) => update('interfaceLanguage', event.target.value)}
                />
              </Field>
            </div>
            <Cluster gap="2" className={styles.accountActions}>
              <Button variant="secondary">Change password</Button>
              <Button variant="secondary">Connected accounts (Google, GitHub)</Button>
              <Button variant="ghost" className={styles.dangerAction}>
                Delete account…
              </Button>
            </Cluster>
          </SectionCard>

          <section id="history">
            <Cluster justify="space-between" align="baseline" className={styles.historyHeader}>
              <h3 className={styles.historyTitle}>Job history</h3>
              <SegmentedControl
                options={HISTORY_TABS}
                value={historyTab}
                onChange={setHistoryTab}
                ariaLabel="History filter"
              />
            </Cluster>
            <DataTable
              columns={columns}
              rows={history.filter((row) => row.status === historyTab)}
              rowKey={(row) => row.jobId}
              emptyMessage={`No ${historyTab} positions yet.`}
              mobileAreas={'"title date" "company eligibility"'}
            />
          </section>

          <Cluster
            justify="flex-end"
            gap="2"
            className={styles.saveBar}
          >
            <Button variant="secondary" onClick={() => setDraft(profile)}>
              Discard changes
            </Button>
            <Button variant="primary">Save profile</Button>
          </Cluster>
        </Stack>
      </div>

      <div className={styles.mobileSaveBar}>
        <Button as={Link} variant="secondary" href="/feed">
          <Icon icon={ChevronLeft} size={16} />
          Feed
        </Button>
        <Button variant="primary" className={styles.saveAction}>
          Save profile
        </Button>
      </div>
    </AppShell>
  )
}
