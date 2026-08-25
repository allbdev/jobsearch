'use client'

import { Bookmark, ExternalLink, X } from 'lucide-react'
import type { Job } from '@jobsearch/shared'
import { CONTRACT_MODEL_LABELS, JOB_SOURCE_LABELS } from '@jobsearch/shared'
import { Button } from '../primitives/Button'
import { Cluster, Stack } from '../primitives/Stack'
import { Icon } from '../primitives/Icon'
import { Muted } from '../primitives/Text'
import { Tag } from '../primitives/Tag'
import { EligibilityBadge } from './EligibilityBadge'
import { EvidenceCard } from './EvidenceCard'
import { relativeTime, verifiedLabel } from '../lib/format'
import { color, tint } from '@jobsearch/design-system/tokens'

export interface JobRowProps {
  job: Job
  expanded: boolean
  saved: boolean
  now: number
  onToggle: () => void
  onSave: () => void
  onDismiss: () => void
}

/** One posting in the feed, with its evidence panel. */
export function JobRow({ job, expanded, saved, now, onToggle, onSave, onDismiss }: JobRowProps) {
  const { eligibility } = job

  return (
    <div style={{ borderBottom: `1px solid ${tint(color.text, 8)}` }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          gap: 'var(--space-2) var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          cursor: 'pointer',
        }}
      >
        <Stack gap={7} style={{ minWidth: 0 }}>
          <Cluster gap={10} align="baseline">
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, lineHeight: 1.15 }}>
              {job.title}
            </span>
            <Muted style={{ fontSize: 13 }}>{job.company}</Muted>
          </Cluster>
          <Cluster gap="2">
            <EligibilityBadge verdict={eligibility.verdict} regionLabel={eligibility.regionLabel} />
            <Tag tone="neutral">{CONTRACT_MODEL_LABELS[eligibility.contractModel]}</Tag>
            {job.skills.map((skill) => (
              <Tag key={skill} tone="neutral" style={{ opacity: 0.8 }}>
                {skill}
              </Tag>
            ))}
          </Cluster>
        </Stack>

        <Stack gap="2" align="flex-end">
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>
            {job.compensation.label}
          </span>
          <Muted style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {relativeTime(job.postedAt, now)} · {JOB_SOURCE_LABELS[job.source]}
          </Muted>
          <Cluster gap="1" wrap={false}>
            <Button
              variant="secondary"
              icon
              size="sm"
              title={saved ? 'Saved' : 'Save'}
              aria-pressed={saved}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation()
                onSave()
              }}
              style={{ color: saved ? color.accentStep(700) : 'inherit' }}
            >
              <Bookmark width={14} height={14} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} aria-hidden />
            </Button>
            <Button
              variant="secondary"
              icon
              size="sm"
              title="Dismiss"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation()
                onDismiss()
              }}
            >
              <Icon icon={X} />
            </Button>
            <Button
              as="a"
              variant="primary"
              icon
              size="sm"
              title="Apply"
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event: React.MouseEvent) => event.stopPropagation()}
            >
              <Icon icon={ExternalLink} />
            </Button>
          </Cluster>
        </Stack>
      </div>

      {expanded && eligibility.evidenceSnippet ? (
        <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
          <EvidenceCard
            kicker={`Eligibility evidence · classifier ${eligibility.classifierVersion}`}
            snippet={eligibility.evidenceSnippet}
            footer={
              <>
                Quoted from the posting ·{' '}
                <a
                  href={eligibility.evidenceUrl ?? job.applyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => event.stopPropagation()}
                >
                  view source
                </a>{' '}
                · link verified {verifiedLabel(eligibility.linkVerifiedAt, now)}
              </>
            }
          />
        </div>
      ) : null}
    </div>
  )
}
