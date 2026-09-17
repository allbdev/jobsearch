'use client'

import { useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { useJobFamilyOptions } from '../shared/useJobFamilyOptions'
import { useRegionOptions } from '../shared/useRegionOptions'
import type {
  ContractModel,
  DigestCadence,
  HistoryEntry,
  JobInteraction,
  Profile,
  Seniority,
} from '@jobsearch/shared'
import { contractOptions } from '@jobsearch/shared'
import { saveProfileAction, type ProfileActionResult } from './actions'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import type { Option, ProfileOptions } from './profile-options'
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

export function ProfileScreen({
  profile,
  isNew,
  history,
  options,
}: {
  profile: Profile
  /** No profile saved yet: the form shows defaults, and residence must be chosen. */
  isNew: boolean
  history: HistoryEntry[]
  options: ProfileOptions
}) {
  const [draft, setDraft] = useState(profile)
  const [result, setResult] = useState<ProfileActionResult | null>(null)
  const [saving, startSaving] = useTransition()
  const router = useRouter()
  const [changingPassword, setChangingPassword] = useState(false)
  const [amount, setAmount] = useState(
    profile.minCompensation ? profile.minCompensation.toLocaleString('en-US') : '',
  )
  const [historyTab, setHistoryTab] = useState<JobInteraction>('saved')
  const t = useTranslations('nav')
  const p = useTranslations('profile')
  const format = useFormatter()
  const familyOptions = useJobFamilyOptions()
  const regionOptions = useRegionOptions()

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

  const save = () =>
    startSaving(async () => {
      const digits = amount.replace(/\D/g, '')
      const saved = await saveProfileAction({ ...draft, minCompensation: digits ? Number(digits) : null })
      setResult(saved)
      // Residence changes what every feed matches; re-read the page so its
      // numbers and the saved values are the server's, not the draft's.
      if (saved.ok) router.refresh()
    })
  const invalid = (field: keyof Profile) => (result && !result.ok && result.fields?.includes(field)) ?? false
  const fieldError = (field: keyof Profile) =>
    invalid(field) ? <span role="alert">{p(`errors.${field === 'residenceCountry' ? 'residence' : 'field'}`)}</span> : undefined
  const saveStatus = result ? (
    <p role={result.ok ? 'status' : 'alert'} className={styles.saveStatus}>
      {result.ok ? p('saved') : p(`errors.${result.error}`)}
    </p>
  ) : null

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
      // The API sends an ISO timestamp (#69); the reader's locale decides how it reads.
      render: (row) => <span className="text-muted">{formatDate(format, row.date)}</span>,
    },
  ]

  return (
    <AppShell
      nav={[
        { href: '/feed', label: t('feed') },
        { href: '/profile', label: t('profile'), current: true },
      ]}
      navAside={<SignOutButton action="/api/sign-out" label={t('signOut')} />}
      linkComponent={Link}
      bare
      mobileHeader={
        <>
          <div className={cx('nav', styles.mobileHeader)}>
            <div className={cx('nav-brand', styles.mobileTitle)}>{t('profile')}</div>
            <SignOutButton action="/api/sign-out" label={t('signOut')} />
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
              <Field label={p('residence')} htmlFor="residence" hint={fieldError('residenceCountry')}>
                <Select
                  id="residence"
                  aria-invalid={invalid('residenceCountry')}
                  options={withPlaceholder(options.countries, p('chooseCountry'), draft.residenceCountry)}
                  value={draft.residenceCountry}
                  onChange={(event) => update('residenceCountry', event.target.value)}
                />
              </Field>
              <Field label={p('timezone')} htmlFor="timezone">
                <Select
                  id="timezone"
                  options={options.timeZones}
                  value={draft.timezone}
                  onChange={(event) => update('timezone', event.target.value)}
                />
              </Field>
            </div>

            <Field label={p('targetRegions')}>
              <ChipToggleGroup
                options={regionOptions}
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
                options={options.workLanguages}
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
                  options={options.weekdays}
                  value={draft.digest.sendOn}
                  onChange={(event) => update('digest', { ...draft.digest, sendOn: event.target.value })}
                />
              </Field>
              <Field label={p('sendAt')} htmlFor="send-at">
                <Select
                  id="send-at"
                  className={styles.sendAt}
                  options={options.hours}
                  value={draft.digest.sendAt}
                  onChange={(event) => update('digest', { ...draft.digest, sendAt: event.target.value })}
                />
              </Field>
            </Cluster>
            <div className={styles.emailLanguage}>
              <Field label={p('emailLanguage')} htmlFor="digest-lang">
                <Select
                  id="digest-lang"
                  options={options.emailLanguages}
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
                {/* The account's address, not a profile field: changing it needs
                    re-verification, which does not exist yet. */}
                <Input id="email" type="email" value={draft.email} readOnly />
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
              <Button variant="secondary" onClick={() => setChangingPassword(true)}>
                {p('changePassword')}
              </Button>
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
            {saveStatus}
            {isNew ? null : (
              <Button variant="secondary" onClick={() => setDraft(profile)} disabled={saving}>
                {p('discard')}
              </Button>
            )}
            <Button variant="primary" onClick={save} disabled={saving}>
              {p('save')}
            </Button>
          </Cluster>
        </Stack>
      </div>

      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}

      <div className={styles.mobileSaveBar}>
        <Button as={Link} variant="secondary" href="/feed">
          <Icon icon={ChevronLeft} size={16} />
          {t('feed')}
        </Button>
        <Button variant="primary" className={styles.saveAction} onClick={save} disabled={saving}>
          {p('save')}
        </Button>
      </div>
    </AppShell>
  )
}

/** An empty first option while nothing is chosen, so the select never shows a value that was not picked. */
function withPlaceholder(options: Option[], label: string, value: string): Option[] {
  return value ? options : [{ value: '', label }, ...options]
}

/** "17 Sept" in the page's language, or the string as given if it is not a date. */
function formatDate(format: ReturnType<typeof useFormatter>, value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : format.dateTime(date, { day: 'numeric', month: 'short' })
}
