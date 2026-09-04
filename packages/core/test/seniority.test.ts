import { describe, expect, it } from 'vitest'
import { extractSeniority, stripSeniority } from '../src/seniority'

describe('extractSeniority', () => {
  it.each([
    ['Senior Backend Engineer', 'senior'],
    ['Sr. Product Manager', 'senior'],
    ['Staff Software Engineer', 'staff'],
    ['Principal Business Consultant', 'principal'],
    ['Associate Consultant', 'associate'],
    ['Junior Data Analyst', 'junior'],
    ['Entry Level Consulting Associate', 'junior'],
    ['Software Engineering Intern', 'intern'],
    ['Lead Designer', 'lead'],
  ])('reads %s as %s', (title, level) => {
    expect(extractSeniority(title)).toBe(level)
  })

  it('says nothing when the title says nothing — the common case', () => {
    expect(extractSeniority('Backend Engineer')).toBeNull()
    expect(extractSeniority('Account Executive')).toBeNull()
    expect(extractSeniority('')).toBeNull()
  })

  it('prefers the more specific level when a title stacks them', () => {
    expect(extractSeniority('Senior Staff Engineer')).toBe('staff')
    expect(extractSeniority('Senior Principal Consultant')).toBe('principal')
  })

  // "Lead" is a level in "Lead Engineer" and a role noun everywhere else.
  it('does not read "lead" as a level where it is part of the role', () => {
    expect(extractSeniority('Tech Lead, Payments')).toBeNull()
    expect(extractSeniority('Team Lead')).toBeNull()
    expect(extractSeniority('Lead Generation Specialist')).toBeNull()
  })

  // Manager, Director, Head and VP are ladder rungs *and* roles. Reading them
  // as levels would leave the family matcher nothing to match on.
  it('leaves role nouns alone', () => {
    expect(extractSeniority('Engineering Manager')).toBeNull()
    expect(extractSeniority('Director of Product')).toBeNull()
    expect(extractSeniority('VP of Sales')).toBeNull()
  })
})

describe('stripSeniority', () => {
  it('removes the level and keeps the role', () => {
    expect(stripSeniority('Senior Backend Engineer')).toBe('backend engineer')
    expect(stripSeniority('Associate Business Consultant')).toBe('business consultant')
    expect(stripSeniority('Sr. Staff Product Designer')).toBe('product designer')
  })

  it('removes numeric and roman level suffixes', () => {
    expect(stripSeniority('Software Development Engineer III')).toBe('software development engineer')
    expect(stripSeniority('Data Analyst 2')).toBe('data analyst')
  })

  it('keeps "lead", which is a role noun as often as a level', () => {
    expect(stripSeniority('Tech Lead')).toBe('tech lead')
    expect(stripSeniority('Lead Generation Manager')).toBe('lead generation manager')
  })

  it('keeps a title that states no level unchanged', () => {
    expect(stripSeniority('Engineering Manager')).toBe('engineering manager')
  })
})
