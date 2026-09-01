import { describe, expect, it } from 'vitest'
import {
  buildUserPrompt,
  checkVerdict,
  llmVerdictSchema,
  type LlmVerdict,
} from '../src/eligibility-llm'
import type { EligibilityInput } from '../src/eligibility'

const posting: EligibilityInput = {
  title: 'Senior Backend Engineer',
  locationRaw: 'Remote',
  description:
    'We are a globally distributed team.\n' +
    'We are able to hire in the United States, Canada and the United Kingdom.\n' +
    'Our product is used by students anywhere in the world.',
}

const verdict = (over: Partial<LlmVerdict> = {}): LlmVerdict => ({
  verdict: 'confirmed',
  regionLabel: 'US, Canada, UK',
  eligibleRegions: ['US', 'CA', 'UK'],
  contractModel: 'unknown',
  evidence: 'We are able to hire in the United States, Canada and the United Kingdom.',
  reasoning: 'States the countries it can hire in.',
  ...over,
})

describe('checkVerdict', () => {
  it('keeps a confirmed verdict whose evidence is in the posting', () => {
    const checked = checkVerdict(verdict(), posting)
    expect(checked.verdict).toBe('confirmed')
    expect(checked.eligibleRegions).toEqual(['US', 'CA', 'UK'])
    expect(checked.downgradedFrom).toBeNull()
  })

  it('tolerates whitespace and curly quotes in the quote', () => {
    const wrapped = checkVerdict(
      verdict({ evidence: 'We are able to hire in\n  the United States,   Canada and the United Kingdom.' }),
      posting,
    )
    expect(wrapped.verdict).toBe('confirmed')

    const curly = checkVerdict(
      verdict({
        evidence: '“We are able to hire in the United States, Canada and the United Kingdom.”'.slice(1, -1),
      }),
      posting,
    )
    expect(curly.verdict).toBe('confirmed')
  })

  // The failure this whole guard exists for: the model paraphrases a real
  // sentence into a stronger claim, and the answer reads exactly like a good one.
  it('downgrades a confirmation whose evidence was paraphrased', () => {
    const checked = checkVerdict(
      verdict({
        regionLabel: 'Worldwide',
        eligibleRegions: ['Worldwide'],
        evidence: 'We hire anywhere in the world.',
      }),
      posting,
    )
    expect(checked.verdict).toBe('needs_check')
    expect(checked.downgradedFrom).toBe('confirmed')
    expect(checked.downgradeReason).toBe('evidence not found in the posting')
    expect(checked.eligibleRegions).toEqual([])
    expect(checked.evidenceSnippet).toBeNull()
  })

  // A real run produced "Switzerland only" with no regions: CH is not in the
  // vocabulary, so the confirmation could never intersect a user's location.
  it('downgrades a confirmation whose scope the vocabulary cannot express', () => {
    const checked = checkVerdict(
      verdict({ regionLabel: 'Switzerland only', eligibleRegions: [] }),
      posting,
    )
    expect(checked.verdict).toBe('needs_check')
    expect(checked.downgradeReason).toBe('confirmed without a region in the shared vocabulary')
  })

  it('still allows a rejection with no regions — nothing is eligible, by definition', () => {
    const checked = checkVerdict(
      verdict({
        verdict: 'rejected',
        eligibleRegions: [],
        evidence: 'Our product is used by students anywhere in the world.',
      }),
      posting,
    )
    expect(checked.verdict).toBe('rejected')
  })

  it('downgrades a confirmation with no evidence at all', () => {
    const checked = checkVerdict(verdict({ evidence: null }), posting)
    expect(checked.verdict).toBe('needs_check')
    expect(checked.downgradeReason).toBe('no evidence supplied')
  })

  it('downgrades a rejection on unfound evidence too — a false no also costs the user a job', () => {
    const checked = checkVerdict(
      verdict({ verdict: 'rejected', evidence: 'Must be authorized to work in the US.' }),
      posting,
    )
    expect(checked.verdict).toBe('needs_check')
    expect(checked.downgradedFrom).toBe('rejected')
  })

  it('leaves needs_check alone and carries no evidence', () => {
    const checked = checkVerdict(
      verdict({ verdict: 'needs_check', evidence: null, eligibleRegions: [] }),
      posting,
    )
    expect(checked.verdict).toBe('needs_check')
    expect(checked.downgradedFrom).toBeNull()
    expect(checked.evidenceSnippet).toBeNull()
  })

  it('finds evidence quoted out of the location field', () => {
    const checked = checkVerdict(
      verdict({ evidence: 'Remote' }),
      { ...posting, locationRaw: 'Remote' },
    )
    expect(checked.verdict).toBe('confirmed')
  })
})

describe('length handling', () => {
  // A `max` in the response schema throws away an answer that has already been
  // paid for. The first trial run lost a posting to a 301-character reasoning.
  it('accepts an over-long reasoning rather than failing the whole answer', () => {
    const long = verdict({ reasoning: 'x'.repeat(900) })
    expect(llmVerdictSchema.safeParse(long).success).toBe(true)
    expect(checkVerdict(long, posting).reasoning).toHaveLength(300)
  })

  it('trims an over-long region label to badge length', () => {
    const checked = checkVerdict(verdict({ regionLabel: 'EU + UK + '.repeat(20) }), posting)
    expect(checked.regionLabel).toHaveLength(60)
    expect(checked.verdict).toBe('confirmed')
  })
})

describe('llmVerdictSchema', () => {
  it('rejects a region outside the shared vocabulary', () => {
    expect(llmVerdictSchema.safeParse(verdict({ eligibleRegions: ['Mars'] as never })).success).toBe(
      false,
    )
  })

  it('rejects an unknown verdict', () => {
    expect(llmVerdictSchema.safeParse(verdict({ verdict: 'maybe' as never })).success).toBe(false)
  })
})

describe('buildUserPrompt', () => {
  it('truncates a very long description rather than sending it whole', () => {
    const prompt = buildUserPrompt({ ...posting, description: 'x'.repeat(20000) })
    expect(prompt).toContain('[truncated]')
    expect(prompt.length).toBeLessThan(13000)
  })

  it('says so explicitly when the location field is empty', () => {
    expect(buildUserPrompt({ ...posting, locationRaw: null })).toContain('Location field: (empty)')
  })
})
