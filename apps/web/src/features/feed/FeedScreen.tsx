'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
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

const SORT_OPTIONS = [
  { value: 'best_match', label: 'Best match' },
  { value: 'newest', label: 'Newest' },
] as const

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

  const definitionRows: Array<[string, string]> = [
    ['Job families', definition.jobFamilies.join(', ') || 'All families'],
    ['Eligible from', definition.eligibleFrom.join(' · ')],
    ['Contract', definition.contractModels.map((c) => CONTRACT_MODEL_LABELS[c]).join(' · ')],
    [
      'Min compensation',
      definition.minCompensation
        ? `≥ ${definition.minCompensation.toLocaleString('en-US')} ${definition.currency}`
        : 'No minimum',
    ],
    ['Freshness', `Last ${definition.freshnessDays} days`],
  ]

  return (
    <AppShell
      nav={[
        { href: '/feed', label: 'Feed', current: true },
        { href: '/profile', label: 'Profile' },
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
              title="Edit feed definition"
              aria-label="Edit feed definition"
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
              title="New feed"
              aria-label="New feed"
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
            { href: '/feed', label: 'Feed', icon: Rows3, current: true },
            { href: '/profile', label: 'Profile', icon: User },
          ]}
        />
      }
    >
      <div className={styles.layout}>
        <Stack as="aside" gap="4" className={styles.sidebar}>
          <div>
            <h6 className={styles.sidebarHeading}>Your feeds</h6>
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
              New feed
            </Button>
          </div>

          <Blueprint className={styles.definition}>
            <Overline className={styles.definitionTitle}>Feed definition</Overline>
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
              Edit definition
            </Button>
          </Blueprint>

          <Muted as="div" className={styles.digest}>
            <Icon icon={Mail} size={13} />{' '}
            <span className={styles.digestLabel}>
              Weekly digest active · <Link href="/profile#digest">change</Link>
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
                {jobs.length} matched<span className={styles.longWord}> positions</span> ·{' '}
                <span className={styles.longWord}>index </span>updated{' '}
                {Math.max(1, Math.round((now - Date.parse(stats.indexUpdatedAt)) / 3_600_000))}h ago
              </Muted>
            </div>
            <SegmentedControl
              options={SORT_OPTIONS}
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
                Evaluated {stats.evaluated} postings for this feed · {stats.confirmed} confirmed ·{' '}
                {stats.needsCheck} to confirm · {dismissedCount} dismissed by you
              </span>
              <Button variant="ghost" className={styles.loadMore}>
                Load more
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
