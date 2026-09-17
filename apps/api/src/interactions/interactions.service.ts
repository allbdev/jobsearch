import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { JobInteractionStatus, PrismaClient, User } from '@jobsearch/db'
import type { HistoryEntry } from '@jobsearch/shared'
import { historyEntrySchema } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'

/** The history screen reads at most this many rows; older ones are not lost, just not listed. */
const HISTORY_LIMIT = 200

@Injectable()
export class InteractionsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Sets the reader's status on a job, replacing any earlier one (#67 keeps one row per user and job). */
  async set(user: User, jobId: string, status: JobInteractionStatus) {
    // Any job that exists, expired or not: applying to a posting that has since
    // closed is still something that happened.
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } })
    if (!job) throw new NotFoundException(`job ${jobId} not found`)

    const row = await this.prisma.jobInteraction.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      create: { userId: user.id, jobId, status },
      update: { status },
    })
    return { jobId, status: row.status, updatedAt: row.updatedAt.toISOString() }
  }

  /** Idempotent: clearing something already clear is not an error. */
  async clear(user: User, jobId: string): Promise<void> {
    await this.prisma.jobInteraction.deleteMany({ where: { userId: user.id, jobId } })
  }

  async history(user: User): Promise<HistoryEntry[]> {
    const rows = await this.prisma.jobInteraction.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: HISTORY_LIMIT,
      include: { job: { select: { title: true, company: { select: { name: true } }, eligibility: true } } },
    })
    return rows.map((row) =>
      historyEntrySchema.parse({
        jobId: row.jobId,
        title: row.job.title,
        company: row.job.company.name,
        regionLabel: row.job.eligibility?.regionLabel ?? '',
        confirmed: row.job.eligibility?.verdict === 'confirmed',
        status: row.status,
        // When it reached this status. ISO: the page formats it in the reader's language.
        date: row.updatedAt.toISOString(),
      }),
    )
  }
}
