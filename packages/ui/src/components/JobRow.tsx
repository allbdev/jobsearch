'use client'

import type { Job } from '@jobsearch/shared'
import { CONTRACT_MODEL_LABELS, JOB_SOURCE_LABELS } from '@jobsearch/shared'
import { Button } from '../primitives/Button'
import { Cluster, Stack } from '../primitives/Stack'
import { Icon } from '../primitives/Icon'
import { Bookmark, ExternalLink, X } from '../primitives/icons'
import { Muted } from '../primitives/Text'
import { Tag } from '../primitives/Tag'
import { EligibilityBadge } from './EligibilityBadge'
import { EvidenceCard } from './EvidenceCard'
import { relativeTime, verifiedLabel } from '../lib/format'
import { cx } from '../lib/cx'
import styles from './JobRow.module.css'

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
    <div className={styles.row}>
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
        className={styles.header}
      >
        <Stack gap={7} className={styles.main}>
          <Cluster gap={10} align="baseline">
            <span className={styles.title}>{job.title}</span>
            <Muted className={styles.company}>{job.company}</Muted>
          </Cluster>
          <Cluster gap="2">
            <EligibilityBadge verdict={eligibility.verdict} regionLabel={eligibility.regionLabel} />
            <Tag tone="neutral">{CONTRACT_MODEL_LABELS[eligibility.contractModel]}</Tag>
            {job.skills.map((skill) => (
              <Tag key={skill} tone="neutral" className={styles.skill}>
                {skill}
              </Tag>
            ))}
          </Cluster>
        </Stack>

        <Stack gap="2" className={styles.aside}>
          <span className={styles.salary}>{job.compensation.label}</span>
          <Muted className={styles.meta}>
            {relativeTime(job.postedAt, now)} · {JOB_SOURCE_LABELS[job.source]}
          </Muted>
          <Cluster gap="1" wrap={false}>
            <Button
              variant="secondary"
              icon
              size="sm"
              title={saved ? 'Saved' : 'Save'}
              aria-pressed={saved}
              className={cx(saved && styles.saved)}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation()
                onSave()
              }}
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
        <div className={styles.evidence}>
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
