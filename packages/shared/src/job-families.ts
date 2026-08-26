/**
 * The occupation taxonomy.
 *
 * Homegrown rather than ESCO or O*NET (PLAN.md D12). It exists to do two small
 * jobs — label a posting and filter a feed — while relevance comes from vector
 * similarity. That is what a short curated list does best: a user can read 33
 * options, and a classifier picks reliably from 33 where it would not from
 * ESCO's ~3,000.
 *
 * ── Growing this list ──────────────────────────────────────────────────────
 *
 * It is expected to change as we see what postings and users actually look
 * like. The rules that make that safe:
 *
 * 1. **Ids are permanent.** `engineering-frontend` is written into user
 *    profiles, feed definitions and classified postings. Never rename an id and
 *    never reuse a retired one. Wording changes happen in the message catalogs,
 *    where they are translations rather than data migrations.
 *
 * 2. **Retire, never delete.** A family that stops earning its place becomes
 *    `deprecated`: it disappears from pickers but still resolves, so nobody's
 *    saved profile silently loses a selection.
 *
 * 3. **Merging sets `replacedBy`.** Reads follow the pointer, so a merge needs
 *    no backfill to be correct — only to be tidy.
 *
 * 4. **Splitting bumps `TAXONOMY_VERSION`.** A split cannot be resolved by a
 *    pointer, because the old id maps to two successors. Postings must be
 *    re-classified; the version stamp is what identifies which ones. This is
 *    cheap because `classify` replays from stored raw payloads (PLAN.md §4).
 *
 * 5. **`aliases` absorb feedback without a schema change.** When a user's typed
 *    role or a posting's title does not match anything, we log the raw term.
 *    Recurring terms become aliases first — that is a one-line change — and
 *    only become a new family if they keep appearing and clearly do not belong
 *    to an existing one.
 */

export const TAXONOMY_VERSION = '1'

export const JOB_FAMILY_GROUPS = [
  'engineering',
  'data',
  'design',
  'product',
  'marketing',
  'sales',
  'support',
  'finance',
  'operations',
  'people',
  'legal',
  'content',
] as const

export type JobFamilyGroup = (typeof JOB_FAMILY_GROUPS)[number]

export type JobFamilyStatus = 'active' | 'deprecated'

export interface JobFamily {
  /** Permanent. Written into stored data; never renamed, never reused. */
  id: string
  group: JobFamilyGroup
  status: JobFamilyStatus
  /**
   * Terms that should resolve to this family — for the classifier's prompt and
   * for search. This is the cheap end of the feedback loop: a recurring
   * unmatched term becomes an alias long before it becomes a family.
   */
  aliases: string[]
  /** Set when this family was merged into another. Reads follow it. */
  replacedBy?: string
  /** Taxonomy version that introduced it, for auditing growth over time. */
  since: string
}

const f = (
  id: string,
  group: JobFamilyGroup,
  aliases: string[],
  extra: Partial<JobFamily> = {},
): JobFamily => ({ id, group, status: 'active', aliases, since: '1', ...extra })

/**
 * Labels are NOT here — they live in the message catalogs under `families.<id>`
 * so every family is translated like any other string.
 */
export const JOB_FAMILIES: readonly JobFamily[] = [
  // ── Engineering ──────────────────────────────────────────────────────────
  f('engineering-frontend', 'engineering', ['front end', 'front-end', 'ui engineer', 'web developer']),
  f('engineering-backend', 'engineering', ['back end', 'back-end', 'server-side', 'api engineer']),
  f('engineering-fullstack', 'engineering', ['full stack', 'full-stack']),
  f('engineering-mobile', 'engineering', ['ios', 'android', 'react native', 'flutter']),
  f('engineering-platform', 'engineering', ['devops', 'sre', 'site reliability', 'infrastructure', 'cloud engineer']),
  f('engineering-data', 'engineering', ['data engineer', 'etl', 'analytics engineer', 'data platform']),
  f('engineering-security', 'engineering', ['appsec', 'infosec', 'security engineer', 'penetration tester']),
  f('engineering-qa', 'engineering', ['qa', 'test engineer', 'sdet', 'quality assurance']),
  f('engineering-ai', 'engineering', ['machine learning', 'ml engineer', 'mlops', 'ai engineer']),

  // ── Data ─────────────────────────────────────────────────────────────────
  f('data-analytics', 'data', ['data analyst', 'business intelligence', 'bi analyst']),
  f('data-science', 'data', ['data scientist', 'statistician', 'quantitative analyst']),

  // ── Design ───────────────────────────────────────────────────────────────
  f('design-product', 'design', ['product designer', 'ux designer', 'ui designer', 'interaction designer']),
  f('design-brand', 'design', ['graphic designer', 'brand designer', 'visual designer', 'illustrator']),
  f('design-research', 'design', ['user researcher', 'ux research', 'design research']),

  // ── Product ──────────────────────────────────────────────────────────────
  f('product-management', 'product', ['product manager', 'product owner', 'technical product manager']),

  // ── Marketing ────────────────────────────────────────────────────────────
  f('marketing-growth', 'marketing', ['growth marketer', 'performance marketing', 'seo', 'paid acquisition']),
  f('marketing-content', 'marketing', ['content marketer', 'social media manager', 'community manager']),
  f('marketing-product', 'marketing', ['product marketing', 'pmm', 'go-to-market']),
  f('marketing-communications', 'marketing', ['pr', 'public relations', 'communications manager']),

  // ── Sales ────────────────────────────────────────────────────────────────
  f('sales-account-executive', 'sales', ['account executive', 'ae', 'sales manager', 'closer']),
  f('sales-development', 'sales', ['sdr', 'bdr', 'sales development', 'lead generation']),
  f('sales-partnerships', 'sales', ['partnerships', 'business development', 'channel sales', 'alliances']),

  // ── Support ──────────────────────────────────────────────────────────────
  f('support-customer', 'support', ['customer support', 'technical support', 'helpdesk', 'cx']),
  f('support-success', 'support', ['customer success', 'csm', 'account manager', 'onboarding specialist']),

  // ── Finance ──────────────────────────────────────────────────────────────
  f('finance-accounting', 'finance', ['accountant', 'bookkeeper', 'controller', 'accounts payable']),
  f('finance-planning', 'finance', ['fp&a', 'financial analyst', 'treasury', 'financial planning']),

  // ── Operations ───────────────────────────────────────────────────────────
  f('operations-business', 'operations', ['business operations', 'bizops', 'revenue operations', 'strategy']),
  f('operations-project', 'operations', ['project manager', 'program manager', 'scrum master', 'delivery manager']),

  // ── People ───────────────────────────────────────────────────────────────
  f('people-recruiting', 'people', ['recruiter', 'talent acquisition', 'sourcer', 'technical recruiter']),
  f('people-operations', 'people', ['hr', 'human resources', 'people ops', 'hr business partner']),

  // ── Legal ────────────────────────────────────────────────────────────────
  f('legal-counsel', 'legal', ['lawyer', 'legal counsel', 'paralegal', 'compliance officer']),

  // ── Content ──────────────────────────────────────────────────────────────
  f('content-writing', 'content', ['technical writer', 'copywriter', 'documentation', 'editor']),
  f('content-localization', 'content', ['translator', 'localization', 'localisation', 'subtitler']),
]

const BY_ID = new Map(JOB_FAMILIES.map((family) => [family.id, family]))

/** Families a user can choose. Excludes retired ones. */
export function activeJobFamilies(): JobFamily[] {
  return JOB_FAMILIES.filter((family) => family.status === 'active')
}

export function jobFamiliesByGroup(group: JobFamilyGroup): JobFamily[] {
  return activeJobFamilies().filter((family) => family.group === group)
}

/**
 * Resolves an id to the family that should be shown for it, following a merge.
 * Returns `null` for an id this taxonomy has never known — which is possible
 * when reading data written by a newer deploy, so callers must handle it.
 */
export function resolveJobFamily(id: string, depth = 0): JobFamily | null {
  const family = BY_ID.get(id)
  if (!family) return null
  if (family.replacedBy && depth < 5) return resolveJobFamily(family.replacedBy, depth + 1)
  return family
}

/** Is this id still offered in pickers? */
export function isActiveJobFamily(id: string): boolean {
  return BY_ID.get(id)?.status === 'active'
}
