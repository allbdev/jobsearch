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

  // Replay only what the *rules* decided. `not: RULES_CLASSIFIER_VERSION` also
  // matched every `llm-*` row, so a rules replay overwrote paid LLM verdicts
  // with the free pass's answer -- money spent, then discarded, silently. The
  // LLM pass sits downstream of this one and owns those rows.
  const where: Prisma.JobWhereInput = reprocess
    ? { eligibility: { classifierVersion: { startsWith: 'rules-', not: RULES_CLASSIFIER_VERSION } } }
    : { eligibility: null }

  // No cursor. Both filters above stop matching a row once it is written --
  // `eligibility: null` gains a row, and the version stamp becomes current --
  // so re-querying returns the next unprocessed page on its own.
  //
  // Paging by cursor here was silently wrong: `cursor` anchors on a row that
  // must still satisfy `where`, and this one no longer did, so `skip: 1` ate a
  // *matching* row instead of the anchor. One posting per batch went
  // unclassified -- 8 of 1,713 -- with the run reporting success.
  let lastFirstId: string | undefined

  for (;;) {
    const batch = await prisma.job.findMany({
      where,
      take: BATCH,
      orderBy: { id: 'asc' },
      select: { id: true, title: true, description: true, locationRaw: true },
    })
    if (batch.length === 0) break

    // Without a cursor, a row that somehow survives its own update would spin
    // this loop forever. Fail loudly instead.
    if (batch[0]!.id === lastFirstId) {
      throw new Error(`classify made no progress on job ${batch[0]!.id} — aborting rather than looping`)
    }
    lastFirstId = batch[0]!.id

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
