import { normalizeTitle } from './identity'

/**
 * Read a seniority level out of a job title, and remove it.
 *
 * Two jobs, one function, because they are the same knowledge. The level goes
 * in `jobs.seniority` for filtering; removing it is what lets the family
 * matcher see the role underneath. On the real corpus, ~270 consulting
 * postings were split across a dozen unmatched terms -- "senior consultant",
 * "consultant", "associate business consultant", "principal business
 * consultant" -- that are one role wearing different prefixes.
 *
 * ── What is *not* here ─────────────────────────────────────────────────────
 *
 * "Manager", "Director", "Head" and "VP" are levels in a career ladder, but in
 * a job title they are also the role: "Engineering Manager" and "Account
 * Manager" are different jobs, not different levels of one. Stripping them
 * would destroy the thing the family matcher reads, so they are left alone and
 * this function reports only the modifiers that qualify a role without being
 * one.
 */

export type Seniority = 'intern' | 'junior' | 'associate' | 'mid' | 'senior' | 'staff' | 'principal' | 'lead'

/**
 * Ordered most specific first: "senior staff engineer" is staff, and
 * "entry level" must be tried before "level" could ever matter.
 */
const LEVELS: { level: Seniority; terms: string[] }[] = [
  { level: 'intern', terms: ['intern', 'internship', 'trainee', 'apprentice'] },
  { level: 'junior', terms: ['entry level', 'new grad', 'new graduate', 'graduate', 'junior', 'jr'] },
  { level: 'principal', terms: ['principal'] },
  { level: 'staff', terms: ['staff'] },
  { level: 'lead', terms: ['lead'] },
  { level: 'senior', terms: ['senior', 'sr'] },
  { level: 'associate', terms: ['associate'] },
  { level: 'mid', terms: ['mid level', 'mid'] },
]

const LEAD_AS_NOUN = /\s(?:team|tech|technical|project|delivery)\s+lead\s|\slead\s+generation\s/

/**
 * Roman and arabic level suffixes: "Software Development Engineer III",
 * "Engineer 2". Case-insensitive -- these are written upper case in practice,
 * and this runs before the title is lowercased.
 */
const LEVEL_SUFFIX = /\s+(?:[ivx]{1,4}|[1-5])$/i

function words(title: string): string[] {
  return normalizeTitle(title).split(' ').filter(Boolean)
}

/**
 * The level a title states, or null when it states none.
 *
 * Null is the common and correct answer -- most titles do not say. It is not a
 * reason to guess "mid".
 */
export function extractSeniority(title: string): Seniority | null {
  const tokens = words(title)
  if (tokens.length === 0) return null
  const text = ` ${tokens.join(' ')} `

  for (const { level, terms } of LEVELS) {
    for (const term of terms) {
      if (!text.includes(` ${term} `)) continue
      // "Lead" is a level in "Lead Engineer" and a role noun in "Tech Lead" or
      // "Team Lead" -- and in "Lead Generation" it is a different word
      // altogether. Accept it only where it qualifies what follows.
      if (term === 'lead' && LEAD_AS_NOUN.test(text)) continue
      return level
    }
  }
  return null
}

// "lead" is excluded: it is a role noun often enough that removing it loses
// more than it gains.
const STRIPPABLE = new Set(
  LEVELS.flatMap(({ terms }) => terms.flatMap((t) => t.split(' '))).filter((w) => w !== 'lead'),
)

/**
 * The title with its level modifiers removed, for matching and for grouping.
 *
 * "Lead" is deliberately not stripped: it is a role noun often enough
 * ("Tech Lead", "Lead Generation") that removing it loses more than it gains.
 */
export function stripSeniority(title: string): string {
  return words(title.replace(LEVEL_SUFFIX, ''))
    .filter((word) => !STRIPPABLE.has(word))
    .join(' ')
}
