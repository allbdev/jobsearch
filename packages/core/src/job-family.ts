import { JOB_FAMILIES } from '@jobsearch/shared'
import { normalizeTitle } from './identity'

/**
 * Assign a posting to a job family from its title (PLAN.md D12).
 *
 * The same two-stage economics as eligibility: this pass is free and settles
 * whatever the taxonomy's aliases already describe, and only what it cannot
 * name is worth paying a model to read. It runs on the title alone -- the one
 * field that is reliably about the role rather than the company.
 *
 * Nothing here edits the taxonomy. When a title matches nothing, the caller
 * records the term, which is the growth loop `job-families.ts` describes:
 * recurring terms become aliases, and only persistent unclassifiable ones
 * become families.
 */

export interface FamilyMatch {
  familyId: string
  /** The alias that matched. Kept so a wrong assignment can be traced to a term. */
  matchedTerm: string
}

/**
 * "Front end", "front-end" and "frontend" are the same word to a reader and
 * three different strings to a matcher. `normalizeTitle` collapses punctuation
 * to spaces, which folds the first two together and leaves the third apart --
 * so every term is indexed both spaced and unspaced, and the title is tested
 * both ways. Without this, "Frontend Engineer" -- one of the commonest titles
 * there is -- matches nothing at all.
 */
function variants(term: string): string[] {
  const spaced = normalizeTitle(term)
  const unspaced = spaced.replace(/ /g, '')
  return spaced === unspaced ? [spaced] : [spaced, unspaced]
}

interface IndexedTerm {
  term: string
  familyId: string
  /** Word count of the spaced form. Longer phrases are more specific and win. */
  words: number
}

function buildIndex(): IndexedTerm[] {
  const seen = new Map<string, IndexedTerm>()

  for (const family of JOB_FAMILIES) {
    if (family.status !== 'active') continue
    for (const alias of family.aliases) {
      const words = normalizeTitle(alias).split(' ').length
      for (const term of variants(alias)) {
        // First writer wins, so an ambiguous term keeps whichever family
        // declared it first rather than flipping with iteration order.
        if (!seen.has(term)) seen.set(term, { term, familyId: family.id, words })
      }
    }
  }

  // Longest first: "technical product manager" must be tried before
  // "product manager", and "data engineer" before "data analyst" can be
  // considered at all.
  return [...seen.values()].sort((a, b) => b.term.length - a.term.length)
}

const INDEX = buildIndex()

/** Whole-word containment. Substring matching would read "ae" out of "michael". */
function contains(haystack: string, needle: string): boolean {
  if (haystack === needle) return true
  return (
    haystack.startsWith(`${needle} `) ||
    haystack.endsWith(` ${needle}`) ||
    haystack.includes(` ${needle} `)
  )
}

/**
 * Split a title into clauses before matching.
 *
 * `normalizeTitle` collapses every separator to a space, so a term can match
 * straight across a comma: "Senior People Business Partner, Product &
 * Marketing" contains the string "product marketing" and was filed under
 * marketing, when it is an HR role. Terms have to match inside one clause.
 *
 * Only *spaced* dashes split. An intra-word hyphen is part of the word, and
 * splitting on it would tear "Front-End Engineer" into "front" and "end" --
 * losing the match this function exists to make.
 */
function clauses(title: string): string[] {
  return title
    .split(/[,/|&()]|\s+[-–—]\s+|\s+\+\s+/)
    .map((clause) => normalizeTitle(clause))
    .filter(Boolean)
}

/**
 * The term to record when nothing matches.
 *
 * The first clause, not the whole title: "Associate Business Consultant -
 * Life Sciences Quality" and "... - Life Sciences R&D" are the same unmet role
 * with different suffixes, and storing them whole turns one strong signal into
 * eighteen weak ones. The point of recording is to see which terms recur often
 * enough to earn an alias.
 */
export function unmatchedTermFor(title: string): string | null {
  return clauses(title)[0] ?? null
}

export function matchJobFamily(title: string): FamilyMatch | null {
  const segments = clauses(title)
  if (segments.length === 0) return null

  for (const entry of INDEX) {
    for (const spaced of segments) {
      const unspaced = spaced.replace(/ /g, '')
      if (contains(spaced, entry.term)) return { familyId: entry.familyId, matchedTerm: entry.term }
      if (entry.words > 1 && contains(unspaced, entry.term.replace(/ /g, ''))) {
        return { familyId: entry.familyId, matchedTerm: entry.term }
      }
    }
  }
  return null
}
