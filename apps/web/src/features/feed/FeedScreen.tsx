'use client'

import { useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import type { Feed, FeedResult, FeedSort, Job, JobInteraction } from '@jobsearch/shared'
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
import { BLANK_FEED, FeedDefinitionDialog } from './FeedDefinitionDialog'
import { loadMoreJobsAction, setInteractionAction } from './interaction-actions'
import { useJobFamilyLabels } from '../shared/useJobFamilyOptions'
import { useRegionLabels } from '../shared/useRegionOptions'
import styles from './FeedScreen.module.css'

export function FeedScreen({
  feeds,
  result,
  now,
  sort,
  knowsResidence,
}: {
  feeds: Feed[]
  result: FeedResult
  now: number
  /** Chosen in the URL and applied by the API, over the whole feed. */
  sort: FeedSort
  /** False until a country is saved, which is when the feed starts filtering by it. */
  knowsResidence: boolean
}) {
  const [morePages, setMorePages] = useState<{ key: string; jobs: Job[] }>({ key: '', jobs: [] })
  const [loadingMore, startLoadingMore] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)
  // What this session changed, over what the server sent with each job. Cleared
  // for a job as soon as the server's own answer agrees.
  const [changed, setChanged] = useState<Record<string, JobInteraction | null>>({})
  const [, startInteraction] = useTransition()
  const router = useRouter()
  const [dialog, setDialog] = useState<'new' | 'edit' | null>(null)
  const t = useTranslations('nav')
  const f = useTranslations('feed')
  const locale = useLocale()
  const familyLabels = useJobFamilyLabels()
  const regionLabels = useRegionLabels()

  const sortOptions = [
    { value: 'best_match', label: f('bestMatch') },
    { value: 'newest', label: f('newest') },
  ] as const

  const { feed, stats } = result
  const { definition } = feed

  const statusOf = (job: Job): JobInteraction | null =>
    job.id in changed ? (changed[job.id] ?? null) : (job.interaction ?? null)

  /** Shows the change at once, then asks the server; puts it back if it refused. */
  const record = (job: Job, status: JobInteraction | null) => {
    const previous = statusOf(job)
    setChanged((current) => ({ ...current, [job.id]: status }))
    startInteraction(async () => {
      const ok = await setInteractionAction(job.id, status)
      if (ok) router.refresh()
      else setChanged((current) => ({ ...current, [job.id]: previous }))
    })
  }

  // Pages beyond the first, dropped whenever the feed, its order, or its
  // definition changes -- and de-duplicated, because dismissing a job shifts
  // what the next offset returns.
  //
  // The definition belongs in the key: editing a feed leaves its id and sort
  // alone, so without it pages fetched under the old filters survived the save
  // and were merged with the new first page. The screen then showed a long list
  // beside "1 matched position", and switching sort and back made them come and
  // go -- the stale entry was still there under the old key.
  const pageKey = `${feed.id}:${sort}:${JSON.stringify(feed.definition)}`
  const loaded = morePages.key === pageKey ? morePages.jobs : []
  const jobs = useMemo(() => {
    const byId = new Map([...result.jobs, ...loaded].map((job) => [job.id, job]))
    return [...byId.values()].filter((job) => statusOf(job) !== 'dismissed')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `statusOf` reads `changed`
  }, [result.jobs, loaded, changed])

  // One employer posts the same role once per country -- eleven "Mobility
  // Specialist" rows differing by one word. They are distinct postings, so they
  // are grouped for reading, not merged: the first keeps its row and the rest
  // are listed inside it, each with its own apply link.
  const groups = useMemo(() => {
    const byRole = new Map<string, { job: Job; alsoIn: { id: string; label: string; applyUrl: string }[] }>()
    for (const job of jobs) {
      const key = `${job.company}\u0000${job.title}`
      const group = byRole.get(key)
      // The location is what differs between them; the region is the same for
      // a whole group as often as not ("Worldwide · Worldwide · Worldwide").
      if (group) group.alsoIn.push({ id: job.id, label: job.location ?? job.eligibility.regionLabel, applyUrl: job.applyUrl })
      else byRole.set(key, { job, alsoIn: [] })
    }
    return [...byRole.values()]
  }, [jobs])

  const loadMore = () =>
    startLoadingMore(async () => {
      const next = await loadMoreJobsAction(feed.id, sort, result.jobs.length + loaded.length)
      if (next) setMorePages({ key: pageKey, jobs: [...loaded, ...next] })
    })

  // Dismissed in this session and still in the page the server sent. Once it is
  // re-read they are gone from `result.jobs` and counted by the server instead,
  // so neither number counts them twice.
  const justDismissed = [...result.jobs, ...loaded].filter((job) => changed[job.id] === 'dismissed').length
  const dismissedCount = stats.dismissedByUser + justDismissed
  // The feed's total, not the page's length: the API sends one page of jobs.
  // `matchedCount` already leaves out what the server knows was dismissed.
  const matched = Math.max(0, feed.matchedCount - justDismissed)
  const hours = Math.max(1, Math.round((now - Date.parse(stats.indexUpdatedAt)) / 3_600_000))

  const definitionRows: Array<[string, string]> = [
    [f('jobFamilies'), familyLabels(definition.jobFamilies).join(', ') || f('allFamilies')],
    [f('eligibleFrom'), regionLabels(definition.eligibleFrom).join(' · ') || f('anyRegion')],
    [f('contract'), definition.contractModels.map((c) => CONTRACT_MODEL_LABELS[c]).join(' · ')],
    [
      f('minCompensation'),
      definition.minCompensation
        ? `≥ ${definition.minCompensation.toLocaleString(locale)} ${definition.currency}`
        : f('noMinimum'),
    ],
    [
      f('freshness'),
      definition.freshnessDays ? f('lastDays', { days: definition.freshnessDays }) : f('anyAge'),
    ],
  ]

  return (
    <AppShell
      nav={[
        { href: '/feed', label: t('feed'), current: true },
        { href: '/profile', label: t('profile') },
      ]}
      navAside={<SignOutButton action="/api/sign-out" label={t('signOut')} />}
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
              onClick={() => setDialog('edit')}
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
              onClick={() => setDialog('new')}
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
            <Button variant="ghost" onClick={() => setDialog('new')} className={styles.newFeed}>
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
              onClick={() => setDialog('edit')}
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
                  {f('matchedShort', { count: matched })} · {f('updatedShort', { hours })}
                </span>
                <span className={styles.longForm}>
                  {f('matchedLong', { count: matched })} · {f('updatedLong', { hours })}
                </span>
              </Muted>
            </div>
            <SegmentedControl
              options={sortOptions}
              value={sort}
              onChange={(next) => router.push(`/feed?feed=${feed.id}&sort=${next}`)}
              compactMobile
              ariaLabel="Sort positions"
            />
          </Cluster>

          {/* Without a residence nothing here is filtered by where the reader
              lives, and #74 is what that costs: postings open to one country
              only, shown as if they were open. Say so rather than imply a
              match. */}
          {knowsResidence ? null : (
            <Blueprint className={styles.residenceNotice}>
              <p role="status" className={styles.residenceText}>
                {f('noResidenceTitle')}{' '}
                <Link href="/profile#profile">{f('noResidenceAction')}</Link>
              </p>
            </Blueprint>
          )}

          <Blueprint className={styles.list}>
            <div className={styles.scroll}>
              {groups.map(({ job, alsoIn }) => (
                <JobRow
                  key={job.id}
                  alsoIn={alsoIn}
                  job={job}
                  now={now}
                  expanded={expanded === job.id}
                  saved={statusOf(job) === 'saved'}
                  onToggle={() => setExpanded((current) => (current === job.id ? null : job.id))}
                  onSave={() => record(job, statusOf(job) === 'saved' ? null : 'saved')}
                  onDismiss={() => record(job, 'dismissed')}
                  // Opening the posting is the only signal there is. It is a
                  // guess at "applied", and never overwrites a stronger one.
                  onApply={() => statusOf(job) !== 'applied' && record(job, 'applied')}
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
              {jobs.length < matched ? (
                <Button variant="ghost" className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>
                  {f('loadMore')}
                </Button>
              ) : null}
            </Cluster>
          </Blueprint>
        </main>
      </div>

      {dialog ? (
        <FeedDefinitionDialog
          // Remounted per feed and mode, so a draft never leaks between them.
          key={`${dialog}:${feed.id}`}
          open
          onClose={() => setDialog(null)}
          definition={dialog === 'edit' ? definition : BLANK_FEED}
          feedId={dialog === 'edit' ? feed.id : null}
        />
      ) : null}
    </AppShell>
  )
}
