import { describe, expect, it } from 'vitest'
import { JOB_FAMILIES } from '@jobsearch/shared'
import {
  buildFamilyPrompt,
  checkFamily,
  familyVerdictSchema,
  FAMILY_CATALOGUE,
  FAMILY_SYSTEM_PROMPT,
} from '../src/job-family-llm'

describe('checkFamily', () => {
  it('accepts an id the taxonomy has', () => {
    const checked = checkFamily({ familyId: 'engineering-backend', reason: 'Owns services.' })
    expect(checked.familyId).toBe('engineering-backend')
    expect(checked.rejectedId).toBeNull()
  })

  it('accepts null — the right answer whenever nothing fits', () => {
    const checked = checkFamily({ familyId: null, reason: 'Not covered.' })
    expect(checked.familyId).toBeNull()
    expect(checked.rejectedId).toBeNull()
  })

  // Ids are permanent and written into stored data, so an invented one is not
  // a wrong label, it is corruption. A plausible near-miss is the likely shape.
  it('rejects a plausible id the taxonomy does not have, and keeps what was claimed', () => {
    const checked = checkFamily({ familyId: 'engineering-devops', reason: 'Runs infra.' })
    expect(checked.familyId).toBeNull()
    expect(checked.rejectedId).toBe('engineering-devops')
  })

  it('rejects a retired family, which resolves but must not be assigned anew', () => {
    const retired = JOB_FAMILIES.find((f) => f.status === 'deprecated')
    if (!retired) return
    expect(checkFamily({ familyId: retired.id, reason: 'x' }).familyId).toBeNull()
  })
})

describe('the prompt', () => {
  it('offers every active family, so a correct answer is always available', () => {
    for (const family of JOB_FAMILIES.filter((f) => f.status === 'active')) {
      expect(FAMILY_CATALOGUE).toContain(family.id)
    }
  })

  // Labels are translated (D10). Putting them in the prompt would make the
  // classifier's behaviour depend on the current locale.
  it('carries no display labels, only ids and aliases', () => {
    expect(FAMILY_SYSTEM_PROMPT).not.toContain('Frontend')
    expect(FAMILY_SYSTEM_PROMPT).not.toContain('Gestão')
  })

  it('says plainly that null is a real answer', () => {
    expect(FAMILY_SYSTEM_PROMPT).toContain('null is a real answer')
  })

  it('truncates a long description rather than sending it whole', () => {
    const prompt = buildFamilyPrompt({ title: 'Engineer', description: 'x'.repeat(20000) })
    expect(prompt).toContain('[truncated]')
    expect(prompt.length).toBeLessThan(7000)
  })
})

describe('familyVerdictSchema', () => {
  it('allows a null family', () => {
    expect(familyVerdictSchema.safeParse({ familyId: null, reason: 'none' }).success).toBe(true)
  })

  it('rejects a response with no reason', () => {
    expect(familyVerdictSchema.safeParse({ familyId: 'data-science' }).success).toBe(false)
  })
})
