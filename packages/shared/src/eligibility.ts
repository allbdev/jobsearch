import { z } from 'zod'

/**
 * The product's core claim, per PLAN.md §1: not "is this job remote?" but
 * "will this company hire someone who lives where I live?" — with the line
 * from the posting that proves it.
 *
 * `rejected` postings are classified and retained (so we can report how many
 * were filtered and why) but never enter a feed.
 */
export const eligibilityVerdictSchema = z.enum(['confirmed', 'needs_check', 'rejected'])
export type EligibilityVerdict = z.infer<typeof eligibilityVerdictSchema>

export const contractModelSchema = z.enum([
  'contractor_pj',
  'eor',
  'local_entity',
  'employee_relocation',
  'unknown',
])
export type ContractModel = z.infer<typeof contractModelSchema>

export const CONTRACT_MODEL_LABELS: Record<ContractModel, string> = {
  contractor_pj: 'Contractor / PJ',
  eor: 'EOR (Deel, Oyster…)',
  local_entity: 'Local entity / CLT',
  employee_relocation: 'Employee w/ relocation',
  unknown: 'Unclear',
}

/**
 * Evidence is a column, not a nicety (PLAN.md §4). A `confirmed` verdict
 * without a snippet is a bug — the classifier must quote the posting.
 */
export const eligibilitySchema = z
  .object({
    verdict: eligibilityVerdictSchema,
    /** Human-readable region label shown on the badge, e.g. "Worldwide", "LATAM". */
    regionLabel: z.string(),
    /** ISO-3166 alpha-2 codes the posting is open to. Empty means "unbounded". */
    eligibleCountries: z.array(z.string().length(2)).default([]),
    contractModel: contractModelSchema.default('unknown'),
    evidenceSnippet: z.string().nullable(),
    evidenceUrl: z.string().url().nullable(),
    classifierVersion: z.string(),
    linkVerifiedAt: z.string().datetime().nullable(),
  })
  .refine((e) => e.verdict !== 'confirmed' || Boolean(e.evidenceSnippet), {
    message: 'A confirmed verdict must carry the evidence snippet that proves it',
    path: ['evidenceSnippet'],
  })

export type Eligibility = z.infer<typeof eligibilitySchema>
