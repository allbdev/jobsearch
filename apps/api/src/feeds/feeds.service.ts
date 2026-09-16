import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Feed as FeedRow, PrismaClient, User } from '@jobsearch/db'
import type { Feed, FeedDefinition, FeedResult, FeedSort } from '@jobsearch/shared'
import { feedResultSchema, feedSchema } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'
import { feedOrderBy, feedWhere } from './feed-query'
import { toJob } from './to-job'

@Injectable()
export class FeedsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** The signed-in user's feeds, each with how many live jobs it matches now. */
  async list(user: User, now = new Date()): Promise<Feed[]> {
    const [feeds, residence] = await Promise.all([
      this.prisma.feed.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
      this.residenceOf(user),
    ])
    const counts = await Promise.all(
      feeds.map((feed) => this.prisma.job.count({ where: feedWhere(feed, residence, now) })),
    )
    return feeds.map((feed, index) =>
      feedSchema.parse({ id: feed.id, definition: toDefinition(feed), matchedCount: counts[index] }),
    )
  }

  async result(id: string, user: User, sort: FeedSort, limit: number, now = new Date()): Promise<FeedResult> {
    // Someone else's feed is answered exactly like one that does not exist, so
    // an id reveals nothing about whether it is real.
    const feed = await this.prisma.feed.findFirst({ where: { id, userId: user.id } })
    if (!feed) throw new NotFoundException(`feed ${id} not found`)
    const residence = await this.residenceOf(user)

    const where = feedWhere(feed, residence, now)

    const [rows, matched, confirmed, needsCheck, evaluated, index] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: feedOrderBy(sort),
        take: limit,
        include: {
          company: true,
          eligibility: true,
          // The first source that found it, for the attribution chip.
          rawPostings: { select: { source: { select: { slug: true } } }, orderBy: { fetchedAt: 'asc' }, take: 1 },
        },
      }),
      this.prisma.job.count({ where }),
      this.prisma.job.count({ where: { AND: [where, { eligibility: { is: { verdict: 'confirmed' } } }] } }),
      this.prisma.job.count({ where: { AND: [where, { eligibility: { is: { verdict: 'needs_check' } } }] } }),
      this.prisma.job.count({ where: { expiresAt: null, eligibility: { isNot: null } } }),
      this.prisma.rawPosting.aggregate({ _max: { fetchedAt: true } }),
    ])

    // Parsed on the way out, so a drift between the database and the contract
    // fails here with a field name rather than in the browser.
    return feedResultSchema.parse({
      feed: {
        id: feed.id,
        definition: toDefinition(feed),
        matchedCount: matched,
      },
      jobs: rows.map(toJob),
      stats: {
        evaluated,
        confirmed,
        needsCheck,
        // No interaction model yet, so nothing can have been dismissed.
        dismissedByUser: 0,
        indexUpdatedAt: (index._max.fetchedAt ?? now).toISOString(),
      },
    })
  }

  private async residenceOf(user: User): Promise<string | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id }, select: { residenceCountry: true } })
    return profile?.residenceCountry ?? null
  }
}

function toDefinition(feed: FeedRow): FeedDefinition {
  return {
    name: feed.name,
    jobFamilies: feed.jobFamilies,
    eligibleFrom: feed.eligibleFrom,
    contractModels: feed.contractModels,
    // Stored in minor units; the contract speaks whole currency units.
    minCompensation: feed.minCompensation === null ? null : feed.minCompensation / 100,
    currency: feed.currency,
    freshnessDays: feed.freshnessDays,
    hideRejected: feed.hideRejected,
  }
}
