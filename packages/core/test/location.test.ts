import { describe, expect, it } from 'vitest'
import { mergeLocations } from '../src/location'
import { classifyByRules } from '../src/eligibility'

describe('mergeLocations', () => {
  it('keeps both, in first-seen order', () => {
    expect(mergeLocations('United States', 'United Kingdom')).toBe('United States; United Kingdom')
  })

  it('does not repeat a location that differs only in case or spacing', () => {
    expect(mergeLocations('United States', 'united  states')).toBe('United States')
  })

  it('handles either side being absent', () => {
    expect(mergeLocations(null, 'Canada')).toBe('Canada')
    expect(mergeLocations('Canada', null)).toBe('Canada')
    expect(mergeLocations(null, null)).toBeNull()
    expect(mergeLocations('Canada', '  ')).toBe('Canada')
  })

  it('merges two multi-part strings without duplicating the overlap', () => {
    expect(mergeLocations('A; B', 'B; C')).toBe('A; B; C')
  })

  // The point of the whole function: the merged value has to carry enough for
  // the classifier to see that the role is not one office.
  it('produces a location the rules read as cross-border', () => {
    const merged = mergeLocations('United States', 'Portugal; Canada')!
    expect(classifyByRules({ title: 'Engineer', locationRaw: merged, description: '' }).verdict).toBe(
      'needs_check',
    )
  })
})
