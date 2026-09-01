import { prisma, type Prisma } from '@jobsearch/db'
import { classifyByRules, RULES_CLASSIFIER_VERSION } from '@jobsearch/core'
import { log } from './log'

export interface ClassifyResult {
  considered: number
  confirmed: number
  needsCheck: number
  rejected: number
  /** Settled without an LLM call — the number the unit economics rest on. */
  decidedByRules: number
}

const BATCH = 200

/**
 * Stage 3 of the pipeline (PLAN.md §4): the deterministic eligibility pass.
 *
 * Only the rules run here. Anything they cannot settle is written as
 * `needs_check`, which is both an honest answer to show a user and the queue
 * the LLM pass will read.
 *
 * Re-runnable, like every stage: `classifierVersion` records which rules
 * produced a row, so improving them means re-running over the rows that carry
 * an older stamp rather than re-fetching anything.
 */
export async function classifyJobs(options: { reprocess?: boolean } = {}): Promise<ClassifyResult> {
  const { reprocess = false } = options
  const result: ClassifyResult = {
    considered: 0,
    confirmed: 0,
    needsCheck: 0,
    rejected: 0,
    decidedByRules: 0,
  }

  const where: Prisma.JobWhereInput = reprocess
    ? { eligibility: { classifierVersion: { not: RULES_CLASSIFIER_VERSION } } }
    : { eligibility: null }

  let cursor: string | undefined

  for (;;) {
    const batch = await prisma.job.findMany({
      where,
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, title: true, description: true, locationRaw: true },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1]!.id

    for (const job of batch) {
      result.considered++
      const verdict = classifyByRules({
        title: job.title,
        locationRaw: job.locationRaw,
        description: job.description,
      })

      await prisma.jobEligibility.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          verdict: verdict.verdict,
          regionLabel: verdict.regionLabel,
          eligibleRegions: verdict.eligibleRegions,
          contractModel: verdict.contractModel,
          evidenceSnippet: verdict.evidenceSnippet,
          classifierVersion: RULES_CLASSIFIER_VERSION,
          decidedByRules: verdict.decidedByRules,
        },
        update: {
          verdict: verdict.verdict,
          regionLabel: verdict.regionLabel,
          eligibleRegions: verdict.eligibleRegions,
          contractModel: verdict.contractModel,
          evidenceSnippet: verdict.evidenceSnippet,
          classifierVersion: RULES_CLASSIFIER_VERSION,
          decidedByRules: verdict.decidedByRules,
          classifiedAt: new Date(),
        },
      })

      if (verdict.verdict === 'confirmed') result.confirmed++
      else if (verdict.verdict === 'rejected') result.rejected++
      else result.needsCheck++
      if (verdict.decidedByRules) result.decidedByRules++
    }
  }

  return result
}
