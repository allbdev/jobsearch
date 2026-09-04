import { describe, expect, it } from 'vitest'
import { JOB_FAMILIES } from '@jobsearch/shared'
import { matchJobFamily, unmatchedTermFor } from '../src/job-family'

const ids = new Set(JOB_FAMILIES.map((f) => f.id))

describe('matchJobFamily', () => {
  it.each([
    ['Senior Backend Engineer', 'engineering-backend'],
    ['Front-End Engineer', 'engineering-frontend'],
    ['Frontend Engineer', 'engineering-frontend'],
    ['Full Stack Developer', 'engineering-fullstack'],
    ['Staff Site Reliability Engineer', 'engineering-platform'],
    ['Technical Product Manager - AI Solutions', 'product-management'],
    ['Customer Success Architect, EMEA', 'support-success'],
    ['Business Development Representative', 'sales-partnerships'],
  ])('reads %s as %s', (title, family) => {
    expect(matchJobFamily(title)?.familyId).toBe(family)
  })

  // "Front end", "front-end" and "frontend" are one word to a reader and three
  // strings to a matcher. Only the first two survive normalisation together.
  it('matches a term whether or not the title spaces it', () => {
    for (const title of ['Front End Engineer', 'Front-End Engineer', 'Frontend Engineer']) {
      expect(matchJobFamily(title)?.familyId).toBe('engineering-frontend')
    }
  })

  // The false positive this clause splitting exists for: the string
  // "product marketing" spans a comma and an ampersand in an HR title.
  it('does not match a term that spans two clauses', () => {
    expect(matchJobFamily('Senior People Business Partner, Product & Marketing')).toBeNull()
    expect(matchJobFamily('Head of Design, Product')).not.toBe(undefined)
  })

  it('prefers the more specific term when two could match', () => {
    expect(matchJobFamily('Technical Product Manager')?.matchedTerm).toBe('technical product manager')
  })

  it('never matches a short alias inside a longer word', () => {
    // 'ae', 'pr', 'hr', 'qa' are real aliases; substring matching would find
    // them in ordinary words.
    expect(matchJobFamily('Michael Praetorius Fellowship')).toBeNull()
    expect(matchJobFamily('Aquarium Technician')).toBeNull()
  })

  it('returns null rather than guessing at a title the taxonomy cannot name', () => {
    expect(matchJobFamily('Associate Business Consultant - Life Sciences Quality')).toBeNull()
    expect(matchJobFamily('')).toBeNull()
  })

  it('only ever returns a real family id', () => {
    for (const title of ['Senior Backend Engineer', 'Product Manager', 'Recruiter', 'Technical Writer']) {
      const match = matchJobFamily(title)
      if (match) expect(ids).toContain(match.familyId)
    }
  })
})

describe('unmatchedTermFor', () => {
  // Storing whole titles turns one recurring role into many unique strings, and
  // the growth policy reads recurrence.
  it('collapses suffixed and levelled variants of the same role onto one term', () => {
    const titles = [
      'Associate Business Consultant - Life Sciences Quality',
      'Senior Business Consultant - Life Sciences R&D',
      'Principal Business Consultant, Commercial Content',
      'Business Consultant',
    ]
    expect(new Set(titles.map(unmatchedTermFor)).size).toBe(1)
    expect(unmatchedTermFor(titles[0]!)).toBe('business consultant')
  })
})
