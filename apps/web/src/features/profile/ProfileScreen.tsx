'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useJobFamilyOptions } from '../shared/useJobFamilyOptions'
import type {
  ContractModel,
  DigestCadence,
  HistoryEntry,
  JobInteraction,
  Profile,
  Seniority,
} from '@jobsearch/shared'
import {
  TARGET_REGIONS,
  WORK_LANGUAGES,
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

/** Section ids. Long and short labels live in the `profile.nav` namespace. */
const SETTINGS_NAV = [
  'profile',
  'occupation',
  'contract',
  'digest',
  'account',
  'history',
] as const

type SectionId = (typeof SETTINGS_NAV)[number]

export function ProfileScreen({ profile, history }: { profile: Profile; history: HistoryEntry[] }) {
  const [draft, setDraft] = useState(profile)
  const [amount, setAmount] = useState(
    profile.minCompensation ? profile.minCompensation.toLocaleString('en-US') : '',
  )
  const [historyTab, setHistoryTab] = useState<JobInteraction>('saved')
  const t = useTranslations('nav')
  const p = useTranslations('profile')
  const familyOptions = useJobFamilyOptions()

  const seniorityOptions: { value: Seniority; label: string }[] = [
    { value: 'junior', label: p('seniorityJunior') },
    { value: 'mid', label: p('seniorityMid') },
    { value: 'senior', label: p('senioritySenior') },
    { value: 'staff_plus', label: p('seniorityStaffPlus') },
  ]
  const cadenceOptions: { value: DigestCadence; label: string }[] = [
    { value: 'daily', label: p('cadenceDaily') },
    { value: 'weekly', label: p('cadenceWeekly') },
    { value: 'off', label: p('cadenceOff') },
  ]
  /** Desktop shows the full section title; the mobile chips show a short form. */
  const sectionLabel: Record<SectionId, { long: string; short: string }> = {
    profile: { long: p('matchingTitle'), short: p('nav.matching') },
    occupation: { long: p('occupationTitle'), short: p('nav.occupation') },
    contract: { long: p('contractTitle'), short: p('nav.contract') },
    digest: { long: p('digestTitle'), short: p('nav.digest') },
    account: { long: p('accountTitle'), short: p('nav.account') },
    history: { long: p('historyTitle'), short: p('nav.history') },
  }

  const historyTabs: { value: JobInteraction; label: string }[] = [
    { value: 'saved', label: p('statusSaved') },
    { value: 'applied', label: p('statusApplied') },
    { value: 'dismissed', label: p('statusDismissed') },
  ]
  const statusLabel: Record<JobInteraction, string> = {
    saved: p('statusSaved'),
    applied: p('statusApplied'),
    dismissed: p('statusDismissed'),
  }

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const columns: Column<HistoryEntry>[] = [
    {
      key: 'title',
      header: p('colPosition'),
      mobileArea: 'title',
      render: (row) => (
        <span className={styles.jobTitle}>
          {row.title}
        </span>
      ),
    },
    {
      key: 'company',
      header: p('colCompany'),
      mobileArea: 'company',
      render: (row) => <span className="text-muted">{row.company}</span>,
    },
    {
      key: 'eligibility',
      header: p('colEligibility'),
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
      header: p('colStatus'),
      // Dropped from the mobile card: the selected tab already states it.
      hideOnMobile: true,
      render: (row) => <Tag tone="neutral">{statusLabel[row.status]}</Tag>,
    },
    {
      key: 'date',
      header: p('colDate'),
      align: 'right',
      mobileArea: 'date',
      render: (row) => <span className="text-muted">{row.date}</span>,
    },
  ]

  return (
    <AppShell
      nav={[
        { href: '/feed', label: t('feed') },
        { href: '/profile', label: t('profile'), current: true },
      ]}
      navAside={<SignOutButton href="/" linkComponent={Link} />}
      linkComponent={Link}
      bare
      mobileHeader={
        <>
          <div className={cx('nav', styles.mobileHeader)}>
            <div className={cx('nav-brand', styles.mobileTitle)}>{t('profile')}</div>
            <SignOutButton href="/" linkComponent={Link} />
          </div>
          <ScrollRow className={styles.sectionChips}>
            {SETTINGS_NAV.map((id) => (
              <Tag key={id} as="a" href={`#${id}`} tone="neutral" className={styles.sectionChip}>
                {sectionLabel[id].short}
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
          <h6 className={styles.navHeading}>{p('settings')}</h6>
          {SETTINGS_NAV.map((id) => (
            <a key={id} href={`#${id}`} className={styles.navLink}>
              {sectionLabel[id].long}
            </a>
          ))}
        </Stack>

        <Stack as="main" gap="8" className={styles.main}>
          <SectionCard
            id="profile"
            title={p('matchingTitle')}
            description={p('matchingDescription')}
          >
            <div className={styles.pair}>
              <Field label={p('residence')} htmlFor="residence">
                <Select
                  id="residence"
                  options={toOptions(['Brazil', 'Argentina', 'Mexico', 'Portugal'])}
                  value={draft.residenceCountry}
                  onChange={(event) => update('residenceCountry', event.target.value)}
                />
              </Field>
              <Field label={p('timezone')} htmlFor="timezone">
                <Select
                  id="timezone"
                  options={toOptions(['UTC−3 · Brasília', 'UTC−5 · Bogotá', 'UTC+0 · Lisbon'])}
                  value={draft.timezone}
                  onChange={(event) => update('timezone', event.target.value)}
                />
              </Field>
            </div>

            <Field label={p('targetRegions')}>
              <ChipToggleGroup
                options={chipOptions(TARGET_REGIONS)}
                selected={draft.targetRegions}
                onToggle={(value) => update('targetRegions', toggleInList(draft.targetRegions, value))}
                ariaLabel={p('targetRegions')}
              />
            </Field>

            <Field
              label={p('workLanguages')}
              hint={p('languagesHint')}
            >
              <ChipToggleGroup
                options={chipOptions(WORK_LANGUAGES)}
                selected={draft.languages}
                onToggle={(value) => update('languages', toggleInList(draft.languages, value))}
                ariaLabel={p('workLanguages')}
              />
            </Field>
          </SectionCard>

          <SectionCard
            id="occupation"
            title={p('occupationTitle')}
            description={p('occupationDescription')}
          >
            <Field label={p('jobFamilies')}>
              <ChipToggleGroup
                options={familyOptions}
                selected={draft.jobFamilies}
                onToggle={(value) => update('jobFamilies', toggleInList(draft.jobFamilies, value))}
                ariaLabel={p('jobFamilies')}
              />
            </Field>

            <div
              className={styles.pair}
            >
              <Field label={p('targetRoles')} htmlFor="roles">
                <Input
                  id="roles"
                  value={draft.targetRoles}
                  onChange={(event) => update('targetRoles', event.target.value)}
                />
              </Field>
              <Field label={p('seniority')}>
                <SegmentedControl
                  fillMobile
                  options={seniorityOptions}
                  value={draft.seniority}
                  onChange={(value) => update('seniority', value)}
                  ariaLabel={p('seniority')}
                />
              </Field>
            </div>

            <Field label={p('skills')} hint={p('skillsHint')}>
              <SkillsInput skills={draft.skills} onChange={(skills) => update('skills', skills)} />
            </Field>
          </SectionCard>

          <SectionCard
            id="contract"
            title={p('contractTitle')}
            description={p('contractDescription')}
          >
            <Field label={p('contractModels')}>
              <ChipToggleGroup<ContractModel>
                options={contractOptions}
                selected={draft.contractModels}
                onToggle={(value) => update('contractModels', toggleInList(draft.contractModels, value))}
                ariaLabel={p('contractModels')}
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
            title={p('digestTitle')}
            description={p('digestDescription')}
          >
            <Cluster gap="4" align="flex-end" className={styles.digestRow}>
              <Field label={p('cadence')}>
                <SegmentedControl
                  fillMobile
                  options={cadenceOptions}
                  value={draft.digest.cadence}
                  onChange={(cadence) => update('digest', { ...draft.digest, cadence })}
                  ariaLabel={p('cadence')}
                />
              </Field>
              <Field label={p('sendOn')} htmlFor="send-on">
                <Select
                  id="send-on"
                  className={styles.sendOn}
                  options={toOptions(['Monday', 'Wednesday', 'Friday'])}
                  value={draft.digest.sendOn}
                  onChange={(event) => update('digest', { ...draft.digest, sendOn: event.target.value })}
                />
              </Field>
              <Field label={p('sendAt')} htmlFor="send-at">
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
              <Field label={p('emailLanguage')} htmlFor="digest-lang">
                <Select
                  id="digest-lang"
                  options={toOptions(['English', 'Português (BR)', 'Español'])}
                  value={draft.digest.language}
                  onChange={(event) => update('digest', { ...draft.digest, language: event.target.value })}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard id="account" title={p('accountTitle')}>
            <div
              className={cx(styles.pair, styles.pairNarrow)}
            >
              <Field label={p('email')} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => update('email', event.target.value)}
                />
              </Field>
              {/* The real control: with locale-prefixed routes the interface
                  language is the URL, so this navigates rather than editing a
                  profile field. The digest language below stays a stored
                  preference -- it decides what the emails are written in. */}
              <Field label={p('interfaceLanguage')}>
                <LocaleSwitcher />
              </Field>
            </div>
            <Cluster gap="2" className={styles.accountActions}>
              <Button variant="secondary">{p('changePassword')}</Button>
              <Button variant="secondary">{p('connectedAccounts')}</Button>
              <Button variant="ghost" className={styles.dangerAction}>
                {p('deleteAccount')}
              </Button>
            </Cluster>
          </SectionCard>

          <section id="history">
            <Cluster justify="space-between" align="baseline" className={styles.historyHeader}>
              <h3 className={styles.historyTitle}>{p('historyTitle')}</h3>
              <SegmentedControl
                options={historyTabs}
                value={historyTab}
                onChange={setHistoryTab}
                ariaLabel={p('historyTitle')}
              />
            </Cluster>
            <DataTable
              columns={columns}
              rows={history.filter((row) => row.status === historyTab)}
              rowKey={(row) => row.jobId}
              emptyMessage={p('emptyHistory', { status: statusLabel[historyTab] })}
              mobileAreas={'"title date" "company eligibility"'}
            />
          </section>

          <Cluster
            justify="flex-end"
            gap="2"
            className={styles.saveBar}
          >
            <Button variant="secondary" onClick={() => setDraft(profile)}>
              {p('discard')}
            </Button>
            <Button variant="primary">{p('save')}</Button>
          </Cluster>
        </Stack>
      </div>

      <div className={styles.mobileSaveBar}>
        <Button as={Link} variant="secondary" href="/feed">
          <Icon icon={ChevronLeft} size={16} />
          {t('feed')}
        </Button>
        <Button variant="primary" className={styles.saveAction}>
          {p('save')}
        </Button>
      </div>
    </AppShell>
  )
}
