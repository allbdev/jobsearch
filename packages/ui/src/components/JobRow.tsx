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
import { formatLabel, useUiLabels } from '../i18n/labels'

export interface JobRowProps {
  job: Job
  expanded: boolean
  saved: boolean
  now: number
  onToggle: () => void
  onSave: () => void
  onDismiss: () => void
  onApply?: () => void
  /**
   * The same role at the same company, posted once per country. Listed here
   * rather than as rows of its own: eleven "Mobility Specialist" lines with
   * one word different is not a feed worth reading.
   */
  alsoIn?: { id: string; label: string; applyUrl: string }[]
}

/** One posting in the feed, with its evidence panel. */
export function JobRow({ job, expanded, saved, now, onToggle, onSave, onDismiss, onApply, alsoIn = [] }: JobRowProps) {
  const labels = useUiLabels()
  const { eligibility } = job
  const actionProps = { applyUrl: job.applyUrl, saved, onSave, onDismiss, onApply }

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
            {alsoIn.length > 0 ? (
              <Tag tone="neutral">{formatLabel(labels.locationCount, { count: alsoIn.length + 1 })}</Tag>
            ) : null}
            {job.skills.map((skill) => (
              <Tag key={skill} tone="neutral" className={styles.skill}>
                {skill}
              </Tag>
            ))}
          </Cluster>

          {/* Why this row is here. Without it, a search for "react" returning
              "Golang Engineer" reads as a broken filter rather than as a
              posting whose boilerplate happens to mention React. */}
          {job.termMatch ? (
            <Muted className={styles.termMatch}>
              {job.termMatch.field === 'title'
                ? formatLabel(labels.matchedTermInTitle, { term: job.termMatch.term })
                : `${formatLabel(labels.matchedTerm, { term: job.termMatch.term })} · “${job.termMatch.snippet}”`}
            </Muted>
          ) : null}
        </Stack>

        <Stack gap="2" className={styles.aside}>
          <span className={styles.salary}>{job.compensation.label}</span>
          <Muted className={styles.meta}>
            {relativeTime(job.postedAt, now, labels)} · {JOB_SOURCE_LABELS[job.source]}
          </Muted>
          <JobActions variant="compact" className={styles.actionsInline} {...actionProps} />
        </Stack>
      </div>

      {expanded && eligibility.evidenceSnippet ? (
        <div className={styles.evidence}>
          <EvidenceCard
            kicker={
              <>
                {labels.evidenceKicker}
                <span className={styles.classifier}>
                  {formatLabel(labels.classifierSuffix, {
                    version: eligibility.classifierVersion,
                  })}
                </span>
              </>
            }
            snippet={eligibility.evidenceSnippet}
            footer={
              <>
                {labels.quotedFrom} ·{' '}
                <a
                  href={eligibility.evidenceUrl ?? job.applyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => event.stopPropagation()}
                >
                  {labels.viewSource}
                </a>{' '}
                · {formatLabel(labels.linkVerified, {
                  when: verifiedLabel(eligibility.linkVerifiedAt, now, labels),
                })}
              </>
            }
          />
          {alsoIn.length > 0 ? (
            <Muted as="p" className={styles.alsoIn}>
              {labels.otherLocations}:{' '}
              {alsoIn.map((variant, index) => (
                <span key={variant.id}>
                  {index > 0 ? ' · ' : null}
                  <a
                    href={variant.applyUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {variant.label}
                  </a>
                </span>
              ))}
            </Muted>
          ) : null}

          <JobActions variant="expanded" className={styles.actionsPanel} {...actionProps} />
        </div>
      ) : null}
    </div>
  )
}
