// zod/v4, not the bare entry point the rest of the repo uses: the Anthropic
// SDK's `zodOutputFormat` is typed against the v4 schema internals, which
// zod 3.25 ships under this subpath. Same installed package either way.
import { z } from 'zod/v4'
import type { ContractModel, EligibilityInput, Verdict } from './eligibility'
import { REGION_VOCABULARY } from './regions'

/**
 * The LLM half of stage 3 (PLAN.md §4).
 *
 * The deterministic rules settle 89% of the corpus. This runs on the rest —
 * postings that say "Remote" and never say where from — and it is the only
 * part of the pipeline that costs money per posting, so everything here is
 * shaped by two constraints: keep the request small, and never let a wrong
 * answer through cheaply.
 *
 * Nothing in this file talks to the network. It builds the request and
 * validates the reply; `apps/worker` owns the API call. That keeps the prompt
 * — which PLAN.md §6 calls the product — unit-testable without a key.
 */

export const LLM_CLASSIFIER_VERSION = 'llm-1'

export const llmVerdictSchema = z.object({
  verdict: z.enum(['confirmed', 'needs_check', 'rejected']),
  // No length caps anywhere in this schema. A `max` here is not a guard, it is
  // a way to throw away a whole answer that has already been paid for: the
  // first trial run lost a posting to a 301-character `reasoning`. Length is
  // trimmed on the way out instead, in `checkVerdict`.
  regionLabel: z
    .string()
    .describe('Short human label for the scope, e.g. "US only", "Worldwide", "EU + UK".'),
  eligibleRegions: z
    .array(z.enum(REGION_VOCABULARY))
    .describe('Empty when the posting states no scope, or when it is not remote at all.'),
  contractModel: z.enum(['contractor_pj', 'eor', 'local_entity', 'employee_relocation', 'unknown']),
  evidence: z
    .string()
    .nullable()
    .describe(
      'A sentence copied VERBATIM from the posting that states the hiring scope. ' +
        'null when the posting never states one. Never paraphrase and never invent.',
    ),
  reasoning: z.string(),
})

export type LlmVerdict = z.infer<typeof llmVerdictSchema>

export interface CheckedVerdict {
  verdict: Verdict
  regionLabel: string
  eligibleRegions: string[]
  contractModel: ContractModel
  evidenceSnippet: string | null
  reasoning: string
  /** Set when the model's answer was overridden — the audit trail for a downgrade. */
  downgradedFrom: Verdict | null
  downgradeReason: string | null
}

export const SYSTEM_PROMPT = `You decide whether a remote job posting states who it is willing to hire, by location.

You are the second pass. A deterministic pass already rejected everything that is
plainly on-site and confirmed everything that plainly names its scope. What reaches
you is the ambiguous middle: postings that say "Remote" without saying remote *from
where*.

Answer only from what the posting says. The reader is someone abroad deciding
whether it is worth applying, and a wrong "yes" wastes their time and destroys
their trust in every other answer.

VERDICTS

confirmed   The posting states, in words, a geographic scope it will hire within.
            "We hire anywhere in the world", "open to candidates in the EU",
            "must reside in Canada" — a stated scope, whether wide or narrow.
rejected    The posting requires something that rules out hiring from abroad:
            work authorization in a specific country, a named office to attend,
            relocation, or a residence requirement you are outside of.
needs_check The posting never states a scope. THIS IS THE CORRECT ANSWER FOR MOST
            OF WHAT YOU SEE. It is not a failure to reach it.

WHAT IS NOT A STATED SCOPE

These describe a company, not an eligibility policy. On their own they are
needs_check, never confirmed:
  - "globally distributed team", "all-remote company", "remote-first culture"
  - "we have employees in 40 countries", "our teams span many timezones"
  - a product or customer reach: "used by students anywhere in the world"
  - a benefit: "work from anywhere for up to 4 weeks a year"
  - a list of office locations with no statement about hiring

A scope is stated only when the sentence is about who may be hired, employed,
located, or authorized to work.

EVIDENCE

confirmed and rejected each require the sentence that proves it, copied
character-for-character out of the posting. If you cannot find such a sentence
to copy, the verdict is needs_check. Do not reconstruct, tidy, translate, or
join sentences — the quote is checked against the source text, and a quote that
is not found there is discarded along with your verdict.`

/** Descriptions are long; the posting body is the expensive part. Cap it. */
const MAX_DESCRIPTION_CHARS = 12000

export function buildUserPrompt(input: EligibilityInput): string {
  const description =
    input.description.length > MAX_DESCRIPTION_CHARS
      ? `${input.description.slice(0, MAX_DESCRIPTION_CHARS)}\n[truncated]`
      : input.description

  return [
    `Title: ${input.title}`,
    `Location field: ${input.locationRaw?.trim() || '(empty)'}`,
    '',
    'Posting:',
    description,
  ].join('\n')
}

/** Quotes differ from the source by whitespace and curly punctuation far more often than by content. */
function normalizeForComparison(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Accept the model's answer only as far as the posting supports it.
 *
 * The rules pass taught this the hard way: 36 of its first 37 "Worldwide"
 * confirmations came from `globally distributed`, a phrase about team culture.
 * A language model makes that same leap more fluently, and its output looks
 * identical either way — so the quote is verified against the source rather
 * than trusted. A confirmed or rejected verdict whose evidence is missing, or
 * absent from the posting, is downgraded to needs_check and the reason is kept.
 */
const MAX_REGION_LABEL = 60
const MAX_REASONING = 300

function trim(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export function checkVerdict(verdict: LlmVerdict, input: EligibilityInput): CheckedVerdict {
  const base = {
    regionLabel: trim(verdict.regionLabel, MAX_REGION_LABEL),
    eligibleRegions: verdict.eligibleRegions as string[],
    contractModel: verdict.contractModel,
    reasoning: trim(verdict.reasoning, MAX_REASONING),
  }

  if (verdict.verdict === 'needs_check') {
    return {
      ...base,
      verdict: 'needs_check',
      evidenceSnippet: null,
      downgradedFrom: null,
      downgradeReason: null,
    }
  }

  const downgrade = (reason: string): CheckedVerdict => ({
    ...base,
    verdict: 'needs_check',
    regionLabel: 'Unstated',
    eligibleRegions: [],
    evidenceSnippet: null,
    downgradedFrom: verdict.verdict,
    downgradeReason: reason,
  })

  // A confirmed verdict with no region is unusable: matching a user is an
  // intersection with where they live, and nothing intersects an empty set. It
  // happens when the posting states a scope the vocabulary cannot express --
  // the first real run produced "Switzerland only" with no regions, because
  // CH is not a code here. Saying "unknown" is honest; storing a confirmation
  // no user can ever match is not.
  if (verdict.verdict === 'confirmed' && verdict.eligibleRegions.length === 0) {
    return downgrade('confirmed without a region in the shared vocabulary')
  }

  const evidence = verdict.evidence?.trim()
  if (!evidence) return downgrade('no evidence supplied')

  const source = normalizeForComparison(
    `${input.title}\n${input.locationRaw ?? ''}\n${input.description}`,
  )
  if (!source.includes(normalizeForComparison(evidence))) {
    return downgrade('evidence not found in the posting')
  }

  return {
    ...base,
    verdict: verdict.verdict,
    evidenceSnippet: evidence,
    downgradedFrom: null,
    downgradeReason: null,
  }
}
