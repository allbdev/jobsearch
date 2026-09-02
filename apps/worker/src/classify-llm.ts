import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '@jobsearch/db'
import {
  buildUserPrompt,
  checkVerdict,
  llmVerdictSchema,
  LLM_CLASSIFIER_VERSION,
  RULES_CLASSIFIER_VERSION,
  SYSTEM_PROMPT,
} from '@jobsearch/core'
import { log } from './log'

export interface LlmClassifyResult {
  considered: number
  confirmed: number
  needsCheck: number
  rejected: number
  /** Answers thrown away because their quote was not in the posting. */
  downgraded: number
  failed: number
  inputTokens: number
  cachedInputTokens: number
  /** Tokens written to the cache. Billed at a premium, not for free. */
  cacheWriteTokens: number
  outputTokens: number
  /** Part of outputTokens. Measured at ~65% of it, so it is the largest single lever. */
  thinkingTokens: number
}

/**
 * Published rates for claude-opus-5, per million tokens, as of 2026-09. Cache
 * reads are a tenth of the base rate and cache *writes* are 1.25x it. Only ever
 * used to print an estimate — nothing branches on it.
 */
const USD_PER_MTOK = { input: 5, cachedRead: 0.5, cacheWrite: 6.25, output: 25 }

const MODEL = process.env.CLASSIFIER_MODEL ?? 'claude-opus-5'
const CONCURRENCY = 4

export function estimateCostUsd(result: LlmClassifyResult): number {
  // The three input counters are disjoint: total input is input_tokens +
  // cache_creation_input_tokens + cache_read_input_tokens. Leaving the write
  // term out under-reported every run, because writes bill above the base rate
  // rather than below it.
  return (
    (result.inputTokens * USD_PER_MTOK.input +
      result.cachedInputTokens * USD_PER_MTOK.cachedRead +
      result.cacheWriteTokens * USD_PER_MTOK.cacheWrite +
      result.outputTokens * USD_PER_MTOK.output) /
    1_000_000
  )
}

/**
 * The second half of stage 3 (PLAN.md §4): the paid pass.
 *
 * It reads only what the rules could not settle — 11% of the corpus — and
 * writes back with its own `classifierVersion`, so re-running after a prompt
 * change re-visits exactly those rows and nothing else.
 *
 * The system prompt is identical on every request and is marked cacheable, so
 * after the first posting in a run its tokens bill at a tenth. That is most of
 * the input on a short posting.
 */
export async function classifyByLlm(
  options: { limit?: number; reprocess?: boolean } = {},
): Promise<LlmClassifyResult> {
  const { limit, reprocess = false } = options
  const result: LlmClassifyResult = {
    considered: 0,
    confirmed: 0,
    needsCheck: 0,
    rejected: 0,
    downgraded: 0,
    failed: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — see apps/worker/.env.example')
  }

  const jobs = await prisma.job.findMany({
    where: {
      eligibility: {
        verdict: 'needs_check',
        classifierVersion: reprocess ? { not: LLM_CLASSIFIER_VERSION } : RULES_CLASSIFIER_VERSION,
      },
    },
    ...(limit ? { take: limit } : {}),
    orderBy: { id: 'asc' },
    select: { id: true, title: true, description: true, locationRaw: true },
  })

  const client = new Anthropic()
  const queue = [...jobs]

  const worker = async (): Promise<void> => {
    for (;;) {
      const job = queue.shift()
      if (!job) return
      result.considered++

      const input = { title: job.title, locationRaw: job.locationRaw, description: job.description }
      try {
        const response = await client.messages.parse({
          model: MODEL,
          max_tokens: 1024,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: buildUserPrompt(input) }],
          output_config: { format: zodOutputFormat(llmVerdictSchema) },
        })

        result.inputTokens += response.usage.input_tokens
        result.cachedInputTokens += response.usage.cache_read_input_tokens ?? 0
        result.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0
        result.outputTokens += response.usage.output_tokens
        result.thinkingTokens += response.usage.output_tokens_details?.thinking_tokens ?? 0

        if (!response.parsed_output) {
          result.failed++
          log('llm returned no parseable verdict', { jobId: job.id })
          continue
        }

        const checked = checkVerdict(response.parsed_output, input)
        if (checked.downgradedFrom) {
          result.downgraded++
          log('discarded an unsupported verdict', {
            jobId: job.id,
            claimed: checked.downgradedFrom,
            reason: checked.downgradeReason,
          })
        }

        await prisma.jobEligibility.update({
          where: { jobId: job.id },
          data: {
            verdict: checked.verdict,
            regionLabel: checked.regionLabel,
            eligibleRegions: checked.eligibleRegions,
            contractModel: checked.contractModel,
            evidenceSnippet: checked.evidenceSnippet,
            classifierVersion: LLM_CLASSIFIER_VERSION,
            decidedByRules: false,
            classifiedAt: new Date(),
          },
        })

        if (checked.verdict === 'confirmed') result.confirmed++
        else if (checked.verdict === 'rejected') result.rejected++
        else result.needsCheck++
      } catch (error) {
        // One posting failing is not a reason to abandon the run: the row keeps
        // its rules verdict and the next run picks it up again.
        result.failed++
        log('llm classification failed', {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return result
}
