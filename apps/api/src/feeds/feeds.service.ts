import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { PrismaClient } from '@jobsearch/db'
import type { FeedResult, FeedSort } from '@jobsearch/shared'
import { feedResultSchema } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'
import { feedOrderBy, feedWhere } from './feed-query'
import { toJob } from './to-job'

@Injectable()
export class FeedsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async result(id: string, sort: FeedSort, limit: number, now = new Date()): Promise<FeedResult> {
    const feed = await this.prisma.feed.findUnique({
      where: { id },
      include: { user: { include: { profile: { select: { residenceCountry: true } } } } },
    })
    if (!feed) throw new NotFoundException(`feed ${id} not found`)

    const where = feedWhere(feed, feed.user.profile?.residenceCountry ?? null, now)

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
        definition: {
          name: feed.name,
          jobFamilies: feed.jobFamilies,
          eligibleFrom: feed.eligibleFrom,
          contractModels: feed.contractModels,
          // Stored in minor units; the contract speaks whole currency units.
          minCompensation: feed.minCompensation === null ? null : feed.minCompensation / 100,
          currency: feed.currency,
          freshnessDays: feed.freshnessDays,
          hideRejected: feed.hideRejected,
        },
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
}
