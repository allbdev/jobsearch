'use client'

import type { Job } from '@jobsearch/shared'
import { CONTRACT_MODEL_LABELS, JOB_SOURCE_LABELS } from '@jobsearch/shared'
import { Cluster, Stack } from '../primitives/Stack'
import { Muted } from '../primitives/Text'
import { Tag } from '../primitives/Tag'
import { EligibilityBadge } from './EligibilityBadge'
import { EvidenceCard } from './EvidenceCard'
import { JobActions } from './JobActions'
import { relativeTime, verifiedLabel } from '../lib/format'
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
  const actionProps = { applyUrl: job.applyUrl, saved, onSave, onDismiss }

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
          <Cluster gap={10} align="baseline" className={styles.titleGroup}>
            <span className={styles.title}>{job.title}</span>
            <Muted className={styles.company}>{job.company}</Muted>
          </Cluster>
          <Cluster gap="2" className={styles.tags}>
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
          <JobActions variant="compact" className={styles.actionsInline} {...actionProps} />
        </Stack>
      </div>

      {expanded && eligibility.evidenceSnippet ? (
        <div className={styles.evidence}>
          <EvidenceCard
            kicker={
              <>
                Eligibility evidence
                <span className={styles.classifier}>
                  {' · classifier '}
                  {eligibility.classifierVersion}
                </span>
              </>
            }
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
          <JobActions variant="expanded" className={styles.actionsPanel} {...actionProps} />
        </div>
      ) : null}
    </div>
  )
}
