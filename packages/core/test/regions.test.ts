import { describe, expect, it } from 'vitest'
import { REGION_VOCABULARY, toRegions } from '../src/regions'

describe('toRegions', () => {
  it.each([
    ['United States', ['US']],
    ['Massachusetts - Boston', ['US']],
    ['San Francisco, CA', ['US']],
    ['New York, NY', ['US']],
    ['United Kingdom - London', ['UK']],
    ['Spain - Barcelona', ['EU']],
    ['Canada - Toronto', ['CA']],
    ['India', ['APAC']],
    ['Remote, US; Canada', ['US', 'CA']],
    ['Europe', ['EU']],
    ['North America', ['US', 'CA']],
  ])('reads %s as %s', (place, expected) => {
    expect(toRegions(place)).toEqual(expected)
  })

  it('always answers in the shared vocabulary', () => {
    for (const place of ['Massachusetts - Boston', 'Remote, Canada; United States', 'India']) {
      for (const region of toRegions(place)) {
        expect(REGION_VOCABULARY).toContain(region)
      }
    }
  })

  it('returns nothing for a place the vocabulary cannot express', () => {
    // Deliberately unmapped: no code exists for these, and inventing one is
    // worse than the caller saying needs_check.
    for (const place of ['Switzerland - Zürich', 'Israel', 'United Arab Emirates', 'Turkey']) {
      expect(toRegions(place)).toEqual([])
    }
    expect(toRegions(null)).toEqual([])
    expect(toRegions('')).toEqual([])
  })

  // The single most dangerous mapping this file could contain.
  it('never reads a bare "Remote" as Worldwide', () => {
    expect(toRegions('Remote')).toEqual([])
    expect(toRegions('remote')).toEqual([])
  })

  it('reads a bare "CA" as California, not Canada', () => {
    // The vocabulary's code for Canada collides with the commonest US state
    // abbreviation. Sources write "Canada" when they mean the country, and
    // "CA" only in "San Francisco, CA" — so the token reads as California.
    // Backwards, this would move Californian jobs to another country silently.
    expect(toRegions('Los Angeles, CA')).toEqual(['US'])
    expect(toRegions('California')).toEqual(['US'])
    expect(toRegions('Canada')).toEqual(['CA'])
    expect(toRegions('Remote, Canada; San Francisco, CA')).toEqual(['US', 'CA'])
  })

  it('does not read "Northern Ireland" as Ireland, or "York" out of "New York"', () => {
    expect(toRegions('Northern Ireland')).toEqual(['UK'])
    expect(toRegions('Ireland - Dublin')).toEqual(['EU'])
    expect(toRegions('New York - New York City')).toEqual(['US'])
  })

  it('keeps Brazil its own code and adds the bloc it belongs to', () => {
    expect(toRegions('Brazil')).toEqual(['LATAM', 'BR'])
  })
})
