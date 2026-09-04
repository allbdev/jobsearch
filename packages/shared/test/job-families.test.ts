import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { JOB_FAMILIES, TAXONOMY_VERSION } from '../src/job-families'

const LOCALES = ['en', 'pt-br', 'es'] as const

function labels(locale: string): Record<string, string> {
  const path = new URL(`../../../apps/web/messages/${locale}.json`, import.meta.url)
  return (JSON.parse(readFileSync(path, 'utf8')) as { families: Record<string, string> }).families
}

describe('taxonomy labels', () => {
  // Nothing enforced this before. A family added without a label renders as a
  // raw id -- or throws, depending on the locale -- and no gate objected. It is
  // the failure mode adding a family invites, so it is the one guarded.
  it.each(LOCALES)('%s has a label for every family', (locale) => {
    const missing = JOB_FAMILIES.map((f) => f.id).filter((id) => !labels(locale)[id])
    expect(missing).toEqual([])
  })

  it.each(LOCALES)('%s has no label for a family that does not exist', (locale) => {
    const ids = new Set(JOB_FAMILIES.map((f) => f.id))
    expect(Object.keys(labels(locale)).filter((id) => !ids.has(id))).toEqual([])
  })
})

describe('taxonomy invariants', () => {
  it('has no duplicate ids — they are permanent and written into stored data', () => {
    const ids = JOB_FAMILIES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never introduces a family from a version that does not exist yet', () => {
    for (const family of JOB_FAMILIES) {
      expect(Number(family.since)).toBeLessThanOrEqual(Number(TAXONOMY_VERSION))
    }
  })

  it('points every replacedBy at a real family', () => {
    const ids = new Set(JOB_FAMILIES.map((f) => f.id))
    for (const family of JOB_FAMILIES) {
      if (family.replacedBy) expect(ids).toContain(family.replacedBy)
    }
  })
})
