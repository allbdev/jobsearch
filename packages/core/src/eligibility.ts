import { extractEvidence } from './evidence'

/**
 * The deterministic eligibility pass (PLAN.md §4, stage 3).
 *
 * Two-stage classification exists for cost: this pass is free and settles the
 * clear cases, and the LLM only sees what is genuinely ambiguous. On the first
 * 703 postings, location alone decides 272 outright.
 *
 * ── What the verdict means ─────────────────────────────────────────────────
 *
 * The index is global and classified once (D1), so a verdict describes the
 * *posting's openness*, not one user's eligibility. Matching a user is a later
 * intersection of `eligibleRegions` with where they live.
 *
 *   rejected     not remote at all — hybrid, in-office, a named city
 *   confirmed    remote, and the posting names the scope it is open to
 *   needs_check  remote, but the scope is unstated
 *
 * That last case is the one the origin prompt cared about most: a posting that
 * says only "Remote" is not a rejection, it is a question.
 */

export const RULES_CLASSIFIER_VERSION = 'rules-1'

export type Verdict = 'confirmed' | 'needs_check' | 'rejected'
export type ContractModel =
  | 'contractor_pj'
  | 'eor'
  | 'local_entity'
  | 'employee_relocation'
  | 'unknown'

export interface EligibilityInput {
  title: string
  locationRaw: string | null
  description: string
}

export interface RulesVerdict {
  verdict: Verdict
  regionLabel: string
  eligibleRegions: string[]
  contractModel: ContractModel
  evidenceSnippet: string | null
  matchedRule: string | null
  /** False when nothing matched and the LLM has to decide. */
  decidedByRules: boolean
}

interface Rule {
  id: string
  pattern: RegExp
  regionLabel: string
  regions: string[]
}

/**
 * Not remote. These are read from the location field, which states it plainly,
 * rather than from prose where "hybrid" may appear in an unrelated sentence.
 */
const NOT_REMOTE_LOCATION = /^\s*(hybrid|in[-\s]?office|on[-\s]?site|office[-\s]?based)\b/i

/** A residence or work-authorisation requirement — the only true blockers. */
const BLOCKING_RULES: Rule[] = [
  {
    id: 'us-authorization-required',
    pattern:
      /\b(must be (legally )?(authorized|authorised|eligible) to work in the (US|U\.S\.|United States)|requires? US work authorization|must have US work authorization)\b/i,
    regionLabel: 'US only',
    regions: ['US'],
  },
  {
    id: 'w2-employment-only',
    pattern: /\bW-?2 (employment|employee|only)\b/i,
    regionLabel: 'US only',
    regions: ['US'],
  },
  {
    id: 'eu-residents-only',
    pattern: /\b(EU|EEA)[/\s-]*(EEA)?\s*(residents?|citizens?)\s+only\b/i,
    regionLabel: 'EU only',
    regions: ['EU'],
  },
  {
    id: 'uk-right-to-work',
    pattern: /\b(right to work in the UK|must have UK work authorization)\b/i,
    regionLabel: 'UK only',
    regions: ['UK'],
  },
  {
    id: 'commuting-distance',
    pattern: /\b(within|commuting distance)\s*(\d+\s*(miles|km|kilometers)\s*(of|from)|of our office)\b/i,
    regionLabel: 'On-site',
    regions: [],
  },
]

/**
 * An explicitly stated open scope.
 *
 * Every pattern requires a *hiring* cue, not merely a mention of the region.
 * The first version matched "globally distributed" and "all-remote", and on
 * the real corpus **36 of 37 "Worldwide" confirmations came from a sentence
 * like "Experience working on a remote, globally distributed team"** — company
 * culture, not an eligibility statement. Only one was genuine.
 *
 * That is the worst failure this classifier can have. A green badge that means
 * "they describe themselves as distributed" rather than "they will hire you
 * where you live" is worse than no badge: it is the exact claim the product
 * makes, made falsely. Under-matching sends a posting to `needs_check`, which
 * is honest; over-matching lies.
 */
const HIRING_CUE = String.raw`(?:open to|hiring|we hire|hire|eligible|candidates?|applicants?|employ|located|residing|residents? of|work from)`

const OPEN_RULES: Rule[] = [
  {
    // "anywhere in the world" looked strong enough to stand alone. It is not:
    // the one posting it matched on the real corpus was product copy —
    // "students can take the test online, on demand, anywhere in the world".
    // The phrase describes a product's reach as readily as a hiring policy, so
    // it needs the cue like everything else.
    id: 'anywhere-in-the-world',
    pattern: new RegExp(
      String.raw`\b(?:${HIRING_CUE})\b[^.\n]{0,60}\b(?:anywhere in the world|from anywhere)\b|\bwork from anywhere in the world\b`,
      'i',
    ),
    regionLabel: 'Worldwide',
    regions: ['Worldwide'],
  },
  {
    id: 'hire-globally',
    pattern: new RegExp(
      String.raw`\b(?:${HIRING_CUE})\b[^.\n]{0,60}\b(?:globally|worldwide|in any country|regardless of location)\b`,
      'i',
    ),
    regionLabel: 'Worldwide',
    regions: ['Worldwide'],
  },
  {
    id: 'no-location-restriction',
    pattern: /\bno (?:location|geographic(?:al)?) restrictions?\b/i,
    regionLabel: 'Worldwide',
    regions: ['Worldwide'],
  },
  {
    id: 'latam',
    pattern: new RegExp(
      String.raw`\b(?:${HIRING_CUE})\b[^.\n]{0,60}\b(?:LATAM|Latin America|South America)\b|\b(?:LATAM|Latin America|South America)\b[^.\n]{0,40}\b(?:only|based|residents?)\b`,
      'i',
    ),
    regionLabel: 'LATAM',
    regions: ['LATAM'],
  },
  {
    id: 'americas',
    pattern: /\bremote\s*[,–-]\s*(?:the\s+)?Americas\b/i,
    regionLabel: 'Americas',
    regions: ['Americas'],
  },
  {
    // A bare "Brazil" is usually an office address. Only a hiring cue makes it
    // an eligibility statement.
    id: 'brazil',
    pattern: new RegExp(
      String.raw`\b(?:${HIRING_CUE})\b[^.\n]{0,60}\bBrazil\b|\bBrazil\b[^.\n]{0,40}\b(?:residents?|based|eligible)\b`,
      'i',
    ),
    regionLabel: 'Brazil listed',
    regions: ['BR'],
  },
]

/** How the company can pay someone abroad — a signal, never a blocker. */
const CONTRACT_RULES: { id: ContractModel; pattern: RegExp }[] = [
  { id: 'eor', pattern: /\b(employer of record|EOR|Deel|Oyster HR|Velocity Global|Remote\.com|Ontop)\b/i },
  { id: 'contractor_pj', pattern: /\b(independent contractor|contractor basis|as a contractor|1099|\bPJ\b)\b/i },
  { id: 'local_entity', pattern: /\b(CLT|local entity|local employment contract)\b/i },
]

function firstMatch(rules: Rule[], text: string): { rule: Rule; index: number; length: number } | null {
  for (const rule of rules) {
    const match = rule.pattern.exec(text)
    if (match) return { rule, index: match.index, length: match[0].length }
  }
  return null
}

function detectContractModel(text: string): ContractModel {
  for (const rule of CONTRACT_RULES) {
    if (rule.pattern.test(text)) return rule.id
  }
  return 'unknown'
}

/**
 * Region-bound remote, read from the location field: "Remote, United States",
 * "Remote, Canada; Remote, US". Open, but only to a named place — so it is a
 * confirmed verdict carrying that scope, not a rejection. A US resident is
 * eligible for it; a Brazilian one is not, and the intersection decides that
 * later rather than here.
 */
const REMOTE_WITH_REGION = /^\s*remote\b\s*[,–—-]\s*(.+)$/i
const BARE_REMOTE = /^\s*(remote|distributed|remote friendly|flexible)\s*$/i

export function classifyByRules(input: EligibilityInput): RulesVerdict {
  const location = input.locationRaw?.trim() ?? ''
  const haystack = `${input.title}\n${location}\n${input.description}`

  const unknown = (verdict: Verdict, regionLabel: string, regions: string[] = []): RulesVerdict => ({
    verdict,
    regionLabel,
    eligibleRegions: regions,
    contractModel: detectContractModel(haystack),
    evidenceSnippet: null,
    matchedRule: null,
    decidedByRules: verdict !== 'needs_check',
  })

  // 1. Not remote at all. Cheapest and most common outcome.
  if (location && NOT_REMOTE_LOCATION.test(location)) {
    return {
      verdict: 'rejected',
      regionLabel: 'On-site',
      eligibleRegions: [],
      contractModel: 'unknown',
      evidenceSnippet: `Location: ${location}`,
      matchedRule: 'location-not-remote',
      decidedByRules: true,
    }
  }

  // 2. An explicit residence or authorisation requirement. Checked before the
  //    open signals, because a posting that says both "remote worldwide" and
  //    "must be authorized to work in the US" means the second one. A false
  //    confirmed is worse than a false needs-check: the whole promise is that a
  //    green badge can be trusted.
  const blocking = firstMatch(BLOCKING_RULES, input.description)
  if (blocking) {
    return {
      verdict: 'rejected',
      regionLabel: blocking.rule.regionLabel,
      eligibleRegions: blocking.rule.regions,
      contractModel: detectContractModel(haystack),
      evidenceSnippet: extractEvidence(input.description, blocking.index, blocking.length),
      matchedRule: blocking.rule.id,
      decidedByRules: true,
    }
  }

  // 3. An explicitly stated open scope.
  const open = firstMatch(OPEN_RULES, haystack)
  if (open) {
    return {
      verdict: 'confirmed',
      regionLabel: open.rule.regionLabel,
      eligibleRegions: open.rule.regions,
      contractModel: detectContractModel(haystack),
      evidenceSnippet: extractEvidence(haystack, open.index, open.length),
      matchedRule: open.rule.id,
      decidedByRules: true,
    }
  }

  // 4. Remote, scoped to a named region by the location field.
  const scoped = location.match(REMOTE_WITH_REGION)
  if (scoped?.[1]) {
    const scope = scoped[1].trim()
    return {
      verdict: 'confirmed',
      regionLabel: scope,
      eligibleRegions: scope.split(/;|,| and /).map((part) => part.replace(/remote/i, '').trim()).filter(Boolean),
      contractModel: detectContractModel(haystack),
      evidenceSnippet: `Location: ${location}`,
      matchedRule: 'location-remote-scoped',
      decidedByRules: true,
    }
  }

  // 5. A named place that is not remote at all.
  if (location && !BARE_REMOTE.test(location) && !/remote/i.test(location)) {
    return {
      verdict: 'rejected',
      regionLabel: location,
      eligibleRegions: [],
      contractModel: 'unknown',
      evidenceSnippet: `Location: ${location}`,
      matchedRule: 'location-named-place',
      decidedByRules: true,
    }
  }

  // 6. "Remote" and nothing else. Exactly the case the origin prompt called
  //    "A CONFIRMAR" — a question for the LLM, not a rejection.
  return unknown('needs_check', location || 'Remote')
}
