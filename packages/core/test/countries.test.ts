import { describe, expect, it } from 'vitest'
import { COUNTRIES_BY_REGION, countriesFor, isOpenToCountry } from '../src/countries'
import { REGION_VOCABULARY } from '../src/regions'

describe('COUNTRIES_BY_REGION', () => {
  it('covers every region in the vocabulary', () => {
    for (const region of REGION_VOCABULARY) {
      expect(COUNTRIES_BY_REGION[region]).toBeDefined()
    }
  })

  it('uses ISO codes, not the region codes — the UK is GB', () => {
    expect(COUNTRIES_BY_REGION.UK).toEqual(['GB'])
  })

  it('has 27 EU member states, and does not treat "EU" as "Europe"', () => {
    expect(COUNTRIES_BY_REGION.EU).toHaveLength(27)
    // Switzerland, Norway and the UK are in Europe and not in the EU. Claiming
    // otherwise would show a Swiss reader jobs they cannot take.
    for (const outside of ['CH', 'NO', 'GB', 'IS', 'UA']) {
      expect(COUNTRIES_BY_REGION.EU).not.toContain(outside)
    }
  })
})

describe('countriesFor', () => {
  it('expands a region to its countries', () => {
    expect(countriesFor(['US'])).toEqual(['US'])
    expect(countriesFor(['UK'])).toEqual(['GB'])
    expect(countriesFor(['EU'])).toHaveLength(27)
  })

  it('unions several regions without repeating an overlap', () => {
    // BR is in LATAM; Americas contains both.
    expect(countriesFor(['BR', 'LATAM'])).toEqual(countriesFor(['LATAM']))
    expect(new Set(countriesFor(['US', 'Americas'])).size).toBe(countriesFor(['Americas']).length)
  })

  it('returns empty for Worldwide, which the contract reads as unbounded', () => {
    expect(countriesFor(['Worldwide'])).toEqual([])
    // …and Worldwide subsumes anything listed beside it.
    expect(countriesFor(['Worldwide', 'US'])).toEqual([])
  })

  it('returns empty for no regions — a different fact, told apart by the verdict', () => {
    expect(countriesFor([])).toEqual([])
  })

  it('ignores a region code it does not know rather than throwing', () => {
    expect(countriesFor(['US', 'Atlantis'])).toEqual(['US'])
  })
})

describe('isOpenToCountry', () => {
  it('answers the one blocking question in the product', () => {
    expect(isOpenToCountry(['LATAM'], 'BR')).toBe(true)
    expect(isOpenToCountry(['US'], 'BR')).toBe(false)
    expect(isOpenToCountry(['EU'], 'PT')).toBe(true)
    expect(isOpenToCountry(['EU'], 'CH')).toBe(false)
  })

  it('is case-insensitive about the residence code', () => {
    expect(isOpenToCountry(['BR'], 'br')).toBe(true)
  })

  // The distinction the whole file exists to protect: unbounded is open to
  // everyone, unknown is open to nobody until it is established.
  it('says yes to Worldwide and no to an unclassified posting', () => {
    expect(isOpenToCountry(['Worldwide'], 'BR')).toBe(true)
    expect(isOpenToCountry([], 'BR')).toBe(false)
  })
})
