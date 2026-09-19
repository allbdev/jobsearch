import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Feed as FeedRow, Prisma, PrismaClient, User } from '@jobsearch/db'
import { feedOrderBy, feedWhere, notDismissedBy, unnamedFamilyWhere } from '@jobsearch/db'
import type { Feed, FeedDefinition, FeedResult, FeedSort } from '@jobsearch/shared'
import { feedDefinitionInputSchema, feedResultSchema, feedSchema } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'

import { toJob } from './to-job'

type ValidDefinition = ReturnType<typeof feedDefinitionInputSchema.parse>

/**
 * A ceiling, not a product limit anyone should meet. Each feed is counted on
 * every visit to the feed page, so an unbounded list is an unbounded query.
 */
export const MAX_FEEDS_PER_USER = 20

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
      feeds.map((feed) => this.prisma.job.count({ where: { AND: [feedWhere(feed, residence, now), notDismissedBy(user.id)] } })),
    )
    return feeds.map((feed, index) =>
      feedSchema.parse({ id: feed.id, definition: toDefinition(feed), matchedCount: counts[index] }),
    )
  }

  async create(user: User, definition: ValidDefinition, now = new Date()): Promise<Feed> {
    const existing = await this.prisma.feed.count({ where: { userId: user.id } })
    if (existing >= MAX_FEEDS_PER_USER) {
      throw new ConflictException({ message: `at most ${MAX_FEEDS_PER_USER} feeds`, reason: 'feed_limit' })
    }
    const feed = await this.prisma.feed.create({ data: { userId: user.id, ...toData(definition) } })
    return this.withCount(feed, user, now)
  }

  /** Replaces the whole definition: the dialog edits all of it at once. */
  async replace(id: string, user: User, definition: ValidDefinition, now = new Date()): Promise<Feed> {
    const { count } = await this.prisma.feed.updateMany({ where: { id, userId: user.id }, data: toData(definition) })
    if (count === 0) throw new NotFoundException(`feed ${id} not found`)
    return this.withCount(await this.prisma.feed.findUniqueOrThrow({ where: { id } }), user, now)
  }

  async remove(id: string, user: User): Promise<void> {
    const { count } = await this.prisma.feed.deleteMany({ where: { id, userId: user.id } })
    if (count === 0) throw new NotFoundException(`feed ${id} not found`)
  }

  async result(
    id: string,
    user: User,
    sort: FeedSort,
    limit: number,
    offset = 0,
    now = new Date(),
  ): Promise<FeedResult> {
    // Someone else's feed is answered exactly like one that does not exist, so
    // an id reveals nothing about whether it is real.
    const feed = await this.prisma.feed.findFirst({ where: { id, userId: user.id } })
    if (!feed) throw new NotFoundException(`feed ${id} not found`)
    const residence = await this.residenceOf(user)

    const matching = feedWhere(feed, residence, now)
    const where: Prisma.JobWhereInput = { AND: [matching, notDismissedBy(user.id)] }

    // Null when the feed names no family: there is nothing to count, and a
    // count over the whole index would be a number about the index, not
    // about what this feed is hiding.
    const unnamed = unnamedFamilyWhere(feed, residence, now)

    const [rows, matched, confirmed, needsCheck, evaluated, index, dismissed, withoutFamily] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: feedOrderBy(sort),
        take: limit,
        skip: offset,
        include: {
          company: true,
          eligibility: true,
          // The first source that found it, for the attribution chip.
          rawPostings: { select: { source: { select: { slug: true } } }, orderBy: { fetchedAt: 'asc' }, take: 1 },
          interactions: { where: { userId: user.id }, select: { status: true } },
        },
      }),
      this.prisma.job.count({ where }),
      this.prisma.job.count({ where: { AND: [where, { eligibility: { is: { verdict: 'confirmed' } } }] } }),
      this.prisma.job.count({ where: { AND: [where, { eligibility: { is: { verdict: 'needs_check' } } }] } }),
      this.prisma.job.count({ where: { expiresAt: null, eligibility: { isNot: null } } }),
      this.prisma.rawPosting.aggregate({ _max: { fetchedAt: true } }),
      // Jobs this feed would show but the reader dismissed: the footer's "dismissed by you".
      this.prisma.job.count({ where: { AND: [matching, { interactions: { some: { userId: user.id, status: 'dismissed' } } }] } }),
      unnamed ? this.prisma.job.count({ where: { AND: [unnamed, notDismissedBy(user.id)] } }) : 0,
    ])

    // Parsed on the way out, so a drift between the database and the contract
    // fails here with a field name rather than in the browser.
    return feedResultSchema.parse({
      feed: {
        id: feed.id,
        definition: toDefinition(feed),
        matchedCount: matched,
      },
      jobs: rows.map((row) => toJob(row, feed.searchTerms)),
      stats: {
        evaluated,
        confirmed,
        needsCheck,
        dismissedByUser: dismissed,
        withoutFamily,
        indexUpdatedAt: (index._max.fetchedAt ?? now).toISOString(),
      },
    })
  }

  private async withCount(feed: FeedRow, user: User, now: Date): Promise<Feed> {
    const matchedCount = await this.prisma.job.count({
      where: { AND: [feedWhere(feed, await this.residenceOf(user), now), notDismissedBy(user.id)] },
    })
    return feedSchema.parse({ id: feed.id, definition: toDefinition(feed), matchedCount })
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
    searchTerms: feed.searchTerms,
    // Stored in minor units; the contract speaks whole currency units.
    minCompensation: feed.minCompensation === null ? null : feed.minCompensation / 100,
    currency: feed.currency,
    freshnessDays: feed.freshnessDays,
    hideRejected: feed.hideRejected,
  }
}

function toData(definition: ValidDefinition): Omit<Prisma.FeedUncheckedCreateInput, 'userId'> {
  return {
    ...definition,
    // Whole units on the wire, minor units in the database (#46).
    minCompensation: definition.minCompensation === null ? null : Math.round(definition.minCompensation * 100),
  }
}
