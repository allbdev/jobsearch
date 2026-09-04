import { describe, expect, it } from 'vitest'
import { classifyByRules } from '../src/eligibility'
import { extractEvidence } from '../src/evidence'

const job = (over: Partial<Parameters<typeof classifyByRules>[0]> = {}) => ({
  title: 'Senior Frontend Engineer',
  locationRaw: null,
  description: 'We are hiring a frontend engineer.',
  ...over,
})

describe('not remote', () => {
  it.each(['Hybrid', 'In-Office', 'On-site', 'hybrid - New York'])('rejects %s', (locationRaw) => {
    const result = classifyByRules(job({ locationRaw }))
    expect(result.verdict).toBe('rejected')
    expect(result.evidenceSnippet).toContain(locationRaw)
  })

  it('rejects a named city with no remote signal', () => {
    const result = classifyByRules(job({ locationRaw: 'San Francisco Bay Area' }))
    expect(result.verdict).toBe('rejected')
    expect(result.matchedRule).toBe('location-named-place')
  })
})

describe('blocking requirements', () => {
  it('rejects an explicit US work-authorization requirement', () => {
    const result = classifyByRules(
      job({ description: 'Applicants must be authorized to work in the United States.' }),
    )
    expect(result.verdict).toBe('rejected')
    expect(result.matchedRule).toBe('us-authorization-required')
    expect(result.evidenceSnippet).toContain('authorized to work')
  })

  it('lets a residence requirement beat an open claim in the same posting', () => {
    // Postings really do say both. A false confirmed is worse than a false
    // needs-check: the whole promise is that a green badge can be trusted.
    const result = classifyByRules(
      job({
        locationRaw: 'Remote',
        description:
          'This is a fully remote role, open to candidates anywhere in the world. Applicants must be authorized to work in the United States.',
      }),
    )
    expect(result.verdict).toBe('rejected')
  })

  it('rejects EU-residents-only', () => {
    const result = classifyByRules(job({ description: 'Open to EU/EEA residents only.' }))
    expect(result.verdict).toBe('rejected')
  })
})

describe('explicitly open scope', () => {
  it('confirms "anywhere in the world" with the sentence as evidence', () => {
    const result = classifyByRules(
      job({
        locationRaw: 'Remote',
        description: 'This role is open to candidates anywhere in the world. We hire via Deel.',
      }),
    )
    expect(result.verdict).toBe('confirmed')
    expect(result.regionLabel).toBe('Worldwide')
    expect(result.evidenceSnippet).toBe(
      'This role is open to candidates anywhere in the world.',
    )
  })

  it('does not confirm product copy that happens to say "anywhere in the world"', () => {
    // Regression from the real corpus: the single Worldwide confirmation left
    // after the culture fix was Duolingo describing its test, not its hiring.
    const result = classifyByRules(
      job({
        locationRaw: 'Remote',
        description:
          'Using AI and remote proctoring, students can take the test online, on demand, anywhere in the world.',
      }),
    )
    expect(result.verdict).toBe('needs_check')
  })

  it.each([
    ['We are hiring across Latin America.', 'LATAM'],
    ['Eligible countries include Brazil and Mexico.', 'Brazil listed'],
  ])('confirms %s', (description, regionLabel) => {
    expect(classifyByRules(job({ locationRaw: 'Remote', description })).regionLabel).toBe(regionLabel)
  })
})

describe('region-bound remote', () => {
  it('confirms with the scope, rather than rejecting', () => {
    // A US-only remote role is genuinely open — to US residents. Whether a
    // given user matches is an intersection done later, not here.
    const result = classifyByRules(job({ locationRaw: 'Remote, United States' }))
    expect(result.verdict).toBe('confirmed')
    // Vocabulary codes, not the source's words — the column is intersected
    // against where a user lives, so both sides must speak one language.
    expect(result.eligibleRegions).toEqual(['US'])
  })

  // The failure this replaced: a scope was stored as captured, so "Remote,
  // Massachusetts - Boston" produced eligibleRegions ["Massachusetts - Boston"]
  // and "Remote, New York, NY" produced ["New York", "NY"]. 1,026 of 1,045
  // confirmed rows held a value no user location could ever intersect.
  it('says needs_check rather than confirming a scope it cannot express', () => {
    const result = classifyByRules(job({ locationRaw: 'Remote, Zürich' }))
    expect(result.verdict).toBe('needs_check')
    expect(result.eligibleRegions).toEqual([])
    expect(result.decidedByRules).toBe(false)
  })

  it('splits a multi-region location', () => {
    const result = classifyByRules(job({ locationRaw: 'Remote, Canada; Remote, United States' }))
    expect(result.eligibleRegions).toEqual(['US', 'CA'])
  })
})

describe('the ambiguous case the origin prompt cared about', () => {
  it.each(['Remote', 'Distributed', null])('leaves %s for the LLM', (locationRaw) => {
    const result = classifyByRules(job({ locationRaw }))
    expect(result.verdict).toBe('needs_check')
    expect(result.decidedByRules).toBe(false)
  })

  it('does not treat a timezone overlap requirement as a blocker', () => {
    // PLAN.md §5: only residence and work authorisation disqualify. A UTC-3
    // user satisfies an EST overlap perfectly well.
    const result = classifyByRules(
      job({ locationRaw: 'Remote', description: 'Requires 4h overlap with EST.' }),
    )
    expect(result.verdict).not.toBe('rejected')
  })
})

describe('contract model', () => {
  it.each([
    ['We hire through our EOR partner Oyster HR.', 'eor'],
    ['This is an independent contractor engagement.', 'contractor_pj'],
    ['Contratação via CLT.', 'local_entity'],
    ['A normal job description.', 'unknown'],
  ])('detects %s', (description, expected) => {
    expect(classifyByRules(job({ locationRaw: 'Remote', description })).contractModel).toBe(expected)
  })
})

describe('extractEvidence', () => {
  it('returns the containing sentence, not a raw offset', () => {
    const text = 'First sentence. The role is open worldwide. Third sentence.'
    const index = text.indexOf('worldwide')
    expect(extractEvidence(text, index, 'worldwide'.length)).toBe('The role is open worldwide.')
  })

  it('keeps the match visible when the sentence is very long', () => {
    const text = `${'x'.repeat(500)} worldwide ${'y'.repeat(500)}.`
    const snippet = extractEvidence(text, text.indexOf('worldwide'), 'worldwide'.length)
    expect(snippet).toContain('worldwide')
    expect(snippet.length).toBeLessThanOrEqual(300)
  })

  it('handles a bullet list, where eligibility lines usually live', () => {
    const text = '• Fully remote\n• Open worldwide\n• Great team'
    const snippet = extractEvidence(text, text.indexOf('Open worldwide'), 'Open worldwide'.length)
    expect(snippet).toBe('Open worldwide')
  })
})

describe('company culture is not an eligibility statement', () => {
  // Regression. The first version matched these, and 36 of 37 "Worldwide"
  // confirmations on the real corpus came from sentences like the first one.
  it.each([
    'Experience working on a remote, globally distributed team.',
    "As a globally distributed, all-remote team, we collaborate asynchronously.",
    'We are a fully distributed company with people in 14 countries.',
    'You will join our global engineering organisation.',
  ])('does not confirm: %s', (description) => {
    const result = classifyByRules(job({ locationRaw: 'Remote', description }))
    expect(result.verdict).toBe('needs_check')
  })

  it('still confirms an actual hiring statement', () => {
    expect(
      classifyByRules(
        job({ locationRaw: 'Remote', description: 'We hire globally, in any country.' }),
      ).verdict,
    ).toBe('confirmed')
  })

  it('does not confirm Brazil from an office address', () => {
    const result = classifyByRules(
      job({ locationRaw: 'Remote', description: 'Our São Paulo, Brazil office opened in 2021.' }),
    )
    expect(result.verdict).toBe('needs_check')
  })

  it('does confirm Brazil from a hiring statement', () => {
    const result = classifyByRules(
      job({ locationRaw: 'Remote', description: 'We are hiring candidates based in Brazil.' }),
    )
    expect(result.regionLabel).toBe('Brazil listed')
  })
})
