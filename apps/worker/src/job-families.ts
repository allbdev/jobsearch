import { prisma } from '@jobsearch/db'
import { extractSeniority, matchJobFamily, unmatchedTermFor } from '@jobsearch/core'

export interface FamilyResult {
  considered: number
  assigned: number
  /** Postings whose title states a level (PLAN.md D12). Most do not. */
  levelled: number
  /** Titles the taxonomy cannot name yet — the queue that grows it (D12). */
  unnamed: number
}

const BATCH = 500

/**
 * Assign every posting a job family from its title (PLAN.md D12).
 *
 * Deliberately not part of the eligibility pass, and carrying no version stamp
 * of its own.
 *
 * Not part of it, because eligibility rows are owned by whichever pass settled
 * them: the rules pass skips `llm-*` rows by design (#32), so riding along with
 * it would have left every LLM-classified posting without a family forever.
 *
 * No stamp, because it does not need one. The work is free and local, so this
 * simply re-reads every job and writes what the current taxonomy says. Adding
 * an alias is then enough on its own — the next run picks up the postings it
 * now matches, with nothing to invalidate and no replay to remember.
 */
export async function assignJobFamilies(): Promise<FamilyResult> {
  const result: FamilyResult = { considered: 0, assigned: 0, levelled: 0, unnamed: 0 }

  // Per-family, not per-row: 33 statements instead of one per posting.
  const byFamily = new Map<string, string[]>()
  const bySeniority = new Map<string, string[]>()
  const unmatched = new Map<string, number>()

  // Paging by cursor is safe here precisely because the filter is empty --
  // nothing this loop writes changes which rows match, so the anchor row is
  // always still in the set. That is the condition `classify` violated.
  let cursor: string | undefined

  for (;;) {
    const batch = await prisma.job.findMany({
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, title: true, jobFamily: true, seniority: true },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1]!.id

    for (const job of batch) {
      result.considered++

      const seniority = extractSeniority(job.title)
      if (seniority) {
        result.levelled++
        if (job.seniority !== seniority) {
          const ids = bySeniority.get(seniority)
          if (ids) ids.push(job.id)
          else bySeniority.set(seniority, [job.id])
        }
      }

      const match = matchJobFamily(job.title)

      if (!match) {
        result.unnamed++
        const term = unmatchedTermFor(job.title)
        if (term) unmatched.set(term, (unmatched.get(term) ?? 0) + 1)
        continue
      }

      result.assigned++
      if (job.jobFamily === match.familyId) continue
      const ids = byFamily.get(match.familyId)
      if (ids) ids.push(job.id)
      else byFamily.set(match.familyId, [job.id])
    }
  }

  for (const [jobFamily, ids] of byFamily) {
    await prisma.job.updateMany({ where: { id: { in: ids } }, data: { jobFamily } })
  }

  for (const [seniority, ids] of bySeniority) {
    await prisma.job.updateMany({ where: { id: { in: ids } }, data: { seniority } })
  }

  for (const [term, occurrences] of unmatched) {
    await prisma.unmatchedTerm.upsert({
      where: { term },
      // `occurrences` is set, not incremented. Every run counts the same
      // postings again, so incrementing would inflate the one number the growth
      // policy reads. Set, it means "postings currently carrying this term",
      // which is the useful question and is idempotent.
      create: { term, origin: 'posting', occurrences },
      update: { occurrences },
    })
  }

  return result
}
