'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Feed, FeedResult, FeedSort } from '@jobsearch/shared'
import { CONTRACT_MODEL_LABELS } from '@jobsearch/shared'
import {
  AppShell,
  Blueprint,
  Button,
  Cluster,
  Filter,
  Icon,
  JobRow,
  Mail,
  MobileTabBar,
  Muted,
  Overline,
  Pencil,
  Plus,
  Rows3,
  ScrollRow,
  SegmentedControl,
  SignOutButton,
  Stack,
  Tag,
  User,
  cx,
} from '@jobsearch/ui'
import { FeedDefinitionDialog } from './FeedDefinitionDialog'
import styles from './FeedScreen.module.css'

export function FeedScreen({
  feeds,
  result,
  now,
}: {
  feeds: Feed[]
  result: FeedResult
  now: number
}) {
  const [sort, setSort] = useState<FeedSort>('best_match')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const t = useTranslations('nav')
  const f = useTranslations('feed')
  const locale = useLocale()

  const sortOptions = [
    { value: 'best_match', label: f('bestMatch') },
    { value: 'newest', label: f('newest') },
  ] as const

  const { feed, stats } = result
  const { definition } = feed

  const jobs = useMemo(() => {
    const visible = result.jobs.filter((job) => !dismissed[job.id])
    if (sort === 'newest') {
      return [...visible].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
    }
    return visible
  }, [result.jobs, dismissed, sort])

  const dismissedCount = result.jobs.filter((job) => dismissed[job.id]).length
  const hours = Math.max(1, Math.round((now - Date.parse(stats.indexUpdatedAt)) / 3_600_000))

  const definitionRows: Array<[string, string]> = [
    [f('jobFamilies'), definition.jobFamilies.join(', ') || f('allFamilies')],
    [f('eligibleFrom'), definition.eligibleFrom.join(' · ')],
    [f('contract'), definition.contractModels.map((c) => CONTRACT_MODEL_LABELS[c]).join(' · ')],
    [
      f('minCompensation'),
      definition.minCompensation
        ? `≥ ${definition.minCompensation.toLocaleString(locale)} ${definition.currency}`
        : f('noMinimum'),
    ],
    [f('freshness'), f('lastDays', { days: definition.freshnessDays })],
  ]

  return (
    <AppShell
      nav={[
        { href: '/feed', label: t('feed'), current: true },
        { href: '/profile', label: t('profile') },
      ]}
      navAside={<SignOutButton href="/" linkComponent={Link} />}
      linkComponent={Link}
      bare
      mobileHeader={
        <>
          <div className={cx('nav', styles.mobileHeader)}>
            <div className={cx('nav-brand', styles.mobileBrand)}>JOBSEARCH</div>
            <Button
              variant="secondary"
              icon
              title={f('editFeedDefinition')}
              aria-label={f('editFeedDefinition')}
              onClick={() => setDialogOpen(true)}
            >
              <Icon icon={Filter} size={16} />
            </Button>
          </div>
          <ScrollRow className={styles.feedChips}>
            {feeds.map((entry) => {
              const active = entry.id === feed.id
              return (
                <Link
                  key={entry.id}
                  href={`/feed?feed=${entry.id}`}
                  className={cx(styles.feedChip, active && styles.feedChipActive)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.feedChipName}>{entry.definition.name}</span>
                  <Tag tone="neutral" size="sm">
                    {entry.matchedCount}
                  </Tag>
                </Link>
              )
            })}
            <button
              type="button"
              title={f('newFeed')}
              aria-label={f('newFeed')}
              className={styles.newFeedChip}
              onClick={() => setDialogOpen(true)}
            >
              <Icon icon={Plus} size={15} />
            </button>
          </ScrollRow>
        </>
      }
      mobileTabs={
        <MobileTabBar
          linkComponent={Link}
          tabs={[
            { href: '/feed', label: t('feed'), icon: Rows3, current: true },
            { href: '/profile', label: t('profile'), icon: User },
          ]}
        />
      }
    >
      <div className={styles.layout}>
        <Stack as="aside" gap="4" className={styles.sidebar}>
          <div>
            <h6 className={styles.sidebarHeading}>{f('yourFeeds')}</h6>
            <Stack gap={6}>
              {feeds.map((entry) => {
                const active = entry.id === feed.id
                return (
                  <Link
                    key={entry.id}
                    href={`/feed?feed=${entry.id}`}
                    className={cx(styles.feedLink, active && styles.feedLinkActive)}
                  >
                    <span className={styles.feedName}>
                      {entry.definition.name}
                    </span>
                    <Tag tone="neutral" size="sm">
                      {entry.matchedCount}
                    </Tag>
                  </Link>
                )
              })}
            </Stack>
            <Button variant="ghost" onClick={() => setDialogOpen(true)} className={styles.newFeed}>
              <Icon icon={Plus} />
              {f('newFeed')}
            </Button>
          </div>

          <Blueprint className={styles.definition}>
            <Overline className={styles.definitionTitle}>{f('definition')}</Overline>
            <Stack gap={9} className={styles.definitionRows}>
              {definitionRows.map(([label, value]) => (
                <div key={label}>
                  <Overline>{label}</Overline>
                  {value}
                </div>
              ))}
            </Stack>
            <Button
              variant="secondary"
              block
              onClick={() => setDialogOpen(true)}
              className={styles.editDefinition}
            >
              <Icon icon={Pencil} />
              {f('editDefinition')}
            </Button>
          </Blueprint>

          <Muted as="div" className={styles.digest}>
            <Icon icon={Mail} size={13} />{' '}
            <span className={styles.digestLabel}>
              {f('digestActive')} · <Link href="/profile#digest">{f('change')}</Link>
            </span>
          </Muted>
        </Stack>

        <main className={styles.main}>
          <Cluster
            justify="space-between"
            align="flex-end"
            gap="3"
            className={styles.header}
          >
            <div>
              <h2 className={styles.title}>{definition.name}</h2>
              <Muted className={styles.subtitle}>
                {/* Two complete sentences, not one sentence assembled from
                    fragments: "{count} matched" + " positions" composes only in
                    English. Portuguese and Spanish put the noun first, which
                    produced "7 compatíveis vagas". One of the pair is hidden
                    per breakpoint. */}
                <span className={styles.shortForm}>
                  {f('matchedShort', { count: jobs.length })} · {f('updatedShort', { hours })}
                </span>
                <span className={styles.longForm}>
                  {f('matchedLong', { count: jobs.length })} · {f('updatedLong', { hours })}
                </span>
              </Muted>
            </div>
            <SegmentedControl
              options={sortOptions}
              value={sort}
              onChange={setSort}
              compactMobile
              ariaLabel="Sort positions"
            />
          </Cluster>

          <Blueprint className={styles.list}>
            <div className={styles.scroll}>
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  now={now}
                  expanded={expanded === job.id}
                  saved={Boolean(saved[job.id])}
                  onToggle={() => setExpanded((current) => (current === job.id ? null : job.id))}
                  onSave={() => setSaved((current) => ({ ...current, [job.id]: !current[job.id] }))}
                  onDismiss={() => setDismissed((current) => ({ ...current, [job.id]: true }))}
                />
              ))}
            </div>
            <Cluster
              justify="space-between"
              className={cx('text-muted', styles.footer)}
            >
              <span>
                {f('stats', {
                  evaluated: stats.evaluated,
                  confirmed: stats.confirmed,
                  needsCheck: stats.needsCheck,
                  dismissed: dismissedCount,
                })}
              </span>
              <Button variant="ghost" className={styles.loadMore}>
                {f('loadMore')}
              </Button>
            </Cluster>
          </Blueprint>
        </main>
      </div>

      <FeedDefinitionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        definition={definition}
      />
    </AppShell>
  )
}
