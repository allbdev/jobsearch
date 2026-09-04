import { prisma } from '@jobsearch/db'
import {
  buildFamilyPrompt,
  checkFamily,
  extractSeniority,
  familyVerdictSchema,
  FAMILY_SYSTEM_PROMPT,
  matchJobFamily,
  TAXONOMY_VERSION,
  unmatchedTermFor,
} from '@jobsearch/core'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { log } from './log'

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
    // `taxonomyVersion` records which version of the taxonomy last decided this
    // posting's family. It is what tells the paid pass which postings it has
    // already considered, and it moves when the taxonomy grows -- so a new
    // family means everything unnamed gets one more look, for free where the
    // matcher can now name it.
    await prisma.job.updateMany({
      where: { id: { in: ids } },
      data: { jobFamily, taxonomyVersion: TAXONOMY_VERSION },
    })
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

export interface LlmFamilyResult {
  considered: number
  assigned: number
  /** The model judged that no family fits. A real answer, not a failure. */
  declined: number
  /** Ids the model returned that the taxonomy does not have. */
  invented: number
  failed: number
  inputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
}

const MODEL = process.env.CLASSIFIER_MODEL ?? 'claude-opus-5'
const EFFORT = process.env.CLASSIFIER_EFFORT ?? 'low'
const CONCURRENCY = 4

/**
 * Ask a model to name the family for postings whose title could not.
 *
 * Selected by `taxonomyVersion`, not by `jobFamily is null`: a posting the
 * model declined has no family and must not be asked again every run, which
 * would repeat the whole bill on every classify. Stamping it records that it
 * was considered under this version of the taxonomy, and a later version asks
 * again -- which is the right behaviour, because a new family may be exactly
 * what it was missing.
 */
export async function classifyFamiliesByLlm(
  options: { limit?: number } = {},
): Promise<LlmFamilyResult> {
  const result: LlmFamilyResult = {
    considered: 0, assigned: 0, declined: 0, invented: 0, failed: 0,
    inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0,
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — see apps/worker/.env.example')
  }

  const jobs = await prisma.job.findMany({
    where: {
      jobFamily: null,
      OR: [{ taxonomyVersion: null }, { taxonomyVersion: { not: TAXONOMY_VERSION } }],
    },
    ...(options.limit ? { take: options.limit } : {}),
    orderBy: { id: 'asc' },
    select: { id: true, title: true, description: true },
  })

  const client = new Anthropic()
  const queue = [...jobs]

  const work = async (): Promise<void> => {
    for (;;) {
      const job = queue.shift()
      if (!job) return
      result.considered++

      try {
        const response = await client.messages.parse({
          model: MODEL,
          max_tokens: 512,
          system: [{ type: 'text', text: FAMILY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: buildFamilyPrompt(job) }],
          output_config: {
            effort: EFFORT as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
            format: zodOutputFormat(familyVerdictSchema),
          },
        })

        result.inputTokens += response.usage.input_tokens
        result.cachedInputTokens += response.usage.cache_read_input_tokens ?? 0
        result.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0
        result.outputTokens += response.usage.output_tokens

        if (!response.parsed_output) {
          result.failed++
          continue
        }

        const checked = checkFamily(response.parsed_output)
        if (checked.rejectedId) {
          result.invented++
          log('discarded a family id the taxonomy does not have', {
            jobId: job.id,
            claimed: checked.rejectedId,
          })
        }

        // Stamped either way. A decline is a considered answer, and re-asking
        // it on every run is how a one-off cost becomes a recurring one.
        await prisma.job.update({
          where: { id: job.id },
          data: { jobFamily: checked.familyId, taxonomyVersion: TAXONOMY_VERSION },
        })

        if (checked.familyId) result.assigned++
        else result.declined++
      } catch (error) {
        result.failed++
        log('llm family classification failed', {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, work))
  return result
}
