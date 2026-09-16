import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { REGION_VOCABULARY } from '../src/regions'

const LOCALES = ['en', 'pt-br', 'es'] as const

function labels(locale: string): Record<string, string> {
  const path = new URL(`../../../apps/web/messages/${locale}.json`, import.meta.url)
  return (JSON.parse(readFileSync(path, 'utf8')) as { regions: Record<string, string> }).regions
}

// The pickers render `t(code)`, so a code without a label shows up raw, or
// throws, depending on the locale. The same guard the families have.
describe('region labels', () => {
  it.each(LOCALES)('%s labels exactly the region vocabulary', (locale) => {
    expect(Object.keys(labels(locale)).sort()).toEqual([...REGION_VOCABULARY].sort())
  })
})
