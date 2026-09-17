import type { Company, Job as JobRow, JobEligibility, JobInteraction, Source } from '@jobsearch/db'
import type { Job, JobSource } from '@jobsearch/shared'
import { jobSourceSchema } from '@jobsearch/shared'

export type JobWithRelations = JobRow & {
  company: Company
  eligibility: JobEligibility | null
  rawPostings: { source: Pick<Source, 'slug'> }[]
  /** The reader's own interaction, at most one (the key is user + job). */
  interactions?: Pick<JobInteraction, 'status'>[]
}

/** A stored job in the wire shape of `jobSchema`. */
export function toJob(row: JobWithRelations): Job {
  const eligibility = row.eligibility
  // The feed query only returns classified jobs; a job without a verdict here
  // is a query bug, and serving it would render a badge nobody decided.
  if (!eligibility) throw new Error(`job ${row.id} has no eligibility`)

  return {
    id: row.id,
    title: row.title,
    company: row.company.name,
    applyUrl: row.applyUrl,
    jobFamily: row.jobFamily,
    skills: row.skills,
    compensation: {
      min: row.salaryMin,
      max: row.salaryMax,
      currency: row.salaryCurrency?.length === 3 ? row.salaryCurrency : null,
      period: row.salaryPeriod === 'month' ? 'month' : 'year',
      // Empty rather than invented: no adapter extracts salary yet, and the
      // wording for "not listed" belongs to the page's locale.
      label: row.salaryLabel ?? '',
    },
    location: row.locationRaw,
    postedAt: row.postedAt.toISOString(),
    source: toSource(row.rawPostings[0]?.source.slug),
    interaction: row.interactions?.[0]?.status ?? null,
    eligibility: {
      verdict: eligibility.verdict,
      regionLabel: eligibility.regionLabel,
      eligibleCountries: eligibility.eligibleCountries,
      contractModel: eligibility.contractModel,
      evidenceSnippet: eligibility.evidenceSnippet,
      evidenceUrl: isUrl(eligibility.evidenceUrl) ? eligibility.evidenceUrl : null,
      classifierVersion: eligibility.classifierVersion,
      linkVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    },
  }
}

function toSource(slug: string | undefined): JobSource {
  const parsed = jobSourceSchema.safeParse(slug)
  return parsed.success ? parsed.data : 'other'
}

function isUrl(value: string | null): value is string {
  if (!value) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}
