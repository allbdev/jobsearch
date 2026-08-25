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
  Icon,
  JobRow,
  Mail,
  Muted,
  Overline,
  Pencil,
  Plus,
  SegmentedControl,
  SignOutButton,
  Stack,
  Tag,
} from '@jobsearch/ui'
import { FeedDefinitionDialog } from './FeedDefinitionDialog'
import { color, hairline } from '@jobsearch/design-system/tokens'

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
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1240,
          margin: '0 auto',
          padding: 'var(--space-6) var(--space-4)',
          display: 'grid',
          gridTemplateColumns: '264px minmax(0,1fr)',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        <Stack as="aside" gap="4" style={{ position: 'sticky', top: 76 }}>
          <div>
            <h6 style={{ marginBottom: 'var(--space-2)' }}>Your feeds</h6>
            <Stack gap={6}>
              {feeds.map((entry) => {
                const active = entry.id === feed.id
                return (
                  <Link
                    key={entry.id}
                    href={`/feed?feed=${entry.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 12px',
                      textDecoration: 'none',
                      background: active ? color.accentStep(100) : 'transparent',
                      border: `1px solid ${active ? color.accent : color.divider}`,
                      color: color.text,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15 }}>
                      {entry.definition.name}
                    </span>
                    <Tag tone="neutral" size="sm">
                      {entry.matchedCount}
                    </Tag>
                  </Link>
                )
              })}
            </Stack>
            <Button variant="ghost" onClick={() => setDialogOpen(true)} style={{ marginTop: 'var(--space-2)' }}>
              <Icon icon={Plus} />
              New feed
            </Button>
          </div>

          <Blueprint style={{ padding: 'var(--space-3)' }}>
            <Overline style={{ marginBottom: 'var(--space-2)' }}>Feed definition</Overline>
            <Stack gap={9} style={{ fontSize: 13 }}>
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
              style={{ marginTop: 'var(--space-3)' }}
            >
              <Icon icon={Pencil} />
              Edit definition
            </Button>
          </Blueprint>

          <Muted as="div" style={{ fontSize: 12 }}>
            <Icon icon={Mail} size={13} />{' '}
            <span style={{ verticalAlign: 2 }}>
              Weekly digest active · <Link href="/profile#digest">change</Link>
            </span>
          </Muted>
        </Stack>

        <main
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 62px - var(--space-6) * 2)',
            position: 'sticky',
            top: 'calc(62px + var(--space-6))',
          }}
        >
          <Cluster
            justify="space-between"
            align="flex-end"
            gap="3"
            style={{ marginBottom: 'var(--space-3)', flex: 'none' }}
          >
            <div>
              <h2 style={{ marginBottom: 2 }}>{definition.name}</h2>
              <Muted style={{ fontSize: 13 }}>
                {jobs.length} matched positions · index updated{' '}
                {Math.max(1, Math.round((now - Date.parse(stats.indexUpdatedAt)) / 3_600_000))}h ago
              </Muted>
            </div>
            <SegmentedControl
              options={SORT_OPTIONS}
              value={sort}
              onChange={setSort}
              ariaLabel="Sort positions"
            />
          </Cluster>

          <Blueprint
            style={{ background: 'transparent', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
              className="text-muted"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 12,
                flex: 'none',
                borderTop: hairline,
              }}
            >
              <span>
                Evaluated {stats.evaluated} postings for this feed · {stats.confirmed} confirmed ·{' '}
                {stats.needsCheck} to confirm · {dismissedCount} dismissed by you
              </span>
              <Button variant="ghost" style={{ fontSize: 13 }}>
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
