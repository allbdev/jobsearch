import { countriesFor } from '@jobsearch/core'
import type { Feed, Prisma } from '@prisma/client'
import type { FeedSort } from '@jobsearch/shared'

/**
 * A saved feed, as a Prisma filter over the live index (D1: a feed is a query,
 * not a copy of the jobs it matched).
 *
 * It lives beside the schema rather than in `apps/api` because the digest
 * worker has to match the same feeds the same way, and two copies of "what this
 * feed means" would drift the first time one of them was fixed. It cannot live
 * in `packages/core`, which is framework-free and may not see Prisma (§6).
 *
 * The rule that shapes everything else: only a `confirmed` verdict states a
 * scope, so only a confirmed job can be filtered *out* by scope. `needs_check`
 * always shows in its own tier -- that is the contract, and hiding it on the
 * strength of a scope nobody has established would drop exactly the jobs the
 * tier exists to surface.
 */
export function feedWhere(
  feed: Pick<
    Feed,
    'jobFamilies' | 'eligibleFrom' | 'contractModels' | 'freshnessDays' | 'hideRejected' | 'searchTerms'
  >,
  residenceCountry: string | null,
  now: Date,
): Prisma.JobWhereInput {
  const scope: Prisma.JobEligibilityWhereInput[] = []

  // The one blocking field (PLAN.md §5). Open to everyone, or to them.
  if (residenceCountry) {
    scope.push({
      OR: [{ eligibleRegions: { has: 'Worldwide' } }, { eligibleCountries: { has: residenceCountry } }],
    })
  }

  // "Must be eligible from" is an overlap, compared as countries rather than
  // region codes: a posting open to LATAM answers a feed asking for BR, and one
  // open only to Brazil answers a feed asking for LATAM. Compared as codes,
  // neither would. Worldwide satisfies anything.
  if (feed.eligibleFrom.length > 0) {
    scope.push({
      OR: [
        { eligibleRegions: { has: 'Worldwide' } },
        { eligibleCountries: { hasSome: countriesFor(feed.eligibleFrom) } },
      ],
    })
  }

  const eligibility: Prisma.JobEligibilityWhereInput[] = [
    {
      OR: [{ verdict: { not: 'confirmed' } }, { verdict: 'confirmed', AND: scope }],
    },
  ]

  if (feed.hideRejected) eligibility.push({ verdict: { not: 'rejected' } })

  // Most postings never say how they hire, so `unknown` always passes. A filter
  // that hid every posting silent on the question would hide nearly all of them.
  if (feed.contractModels.length > 0) {
    eligibility.push({ contractModel: { in: [...feed.contractModels, 'unknown'] } })
  }

  const where: Prisma.JobWhereInput = {
    expiresAt: null,
    eligibility: { is: { AND: eligibility } },
  }

  if (feed.jobFamilies.length > 0) where.jobFamily = { in: feed.jobFamilies }

  // Every term must appear in the posting -- its title or its body. Two terms
  // narrow rather than widen, which is what someone typing "react staff" means.
  //
  // `jobs.skills` is deliberately *not* searched: no adapter fills it, so every
  // row's array is empty and a clause over it can only ever match nothing. When
  // something extracts skills, this is where they join -- with the caveat that
  // Postgres array matching is exact, so "React" would not answer to "react".
  //
  // `contains` rather than the tsvector: full-text search matches lexemes, so
  // "react" would not find "React Native" the way a reader expects. At this size
  // (3k live postings) the scan costs nothing; the GIN index on `searchVector`
  // is there to move to when it does.
  if (feed.searchTerms.length > 0) {
    where.AND = feed.searchTerms.map((term) => ({
      OR: [
        { title: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
      ],
    }))
  }

  // Opt-in only (D14): null means any age, and is the default.
  if (feed.freshnessDays) {
    where.postedAt = { gte: new Date(now.getTime() - feed.freshnessDays * 86_400_000) }
  }

  // `minCompensation` is deliberately not applied. No adapter extracts salary
  // yet, so there is nothing to compare against, and the units a job's salary
  // is stored in get decided by the PR that fills them.
  return where
}

/**
 * Leaves out what this reader dismissed. Separate from `feedWhere`, which
 * describes the feed and is the same for anyone who could own it.
 */
export function notDismissedBy(userId: string): Prisma.JobWhereInput {
  return { interactions: { none: { userId, status: 'dismissed' } } }
}

/**
 * `best_match` is the verdict tier, then recency, until embeddings exist to
 * rank by. The enum's declaration order is confirmed, needs_check, rejected,
 * and Postgres sorts enums by that order.
 */
export function feedOrderBy(sort: FeedSort): Prisma.JobOrderByWithRelationInput[] {
  const newest: Prisma.JobOrderByWithRelationInput[] = [{ postedAt: 'desc' }, { id: 'asc' }]
  return sort === 'newest' ? newest : [{ eligibility: { verdict: 'asc' } }, ...newest]
}
