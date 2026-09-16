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

describe('interface languages', () => {
  // Profiles store these codes and the web routes by them; a code with no
  // catalog would be accepted by the API and then render nothing.
  it('each has a message catalog in the web app', async () => {
    const { INTERFACE_LANGUAGES } = await import('../src/profile')
    const { existsSync } = await import('node:fs')
    for (const locale of INTERFACE_LANGUAGES) {
      expect(existsSync(new URL(`../../../apps/web/messages/${locale}.json`, import.meta.url))).toBe(true)
    }
  })
})
