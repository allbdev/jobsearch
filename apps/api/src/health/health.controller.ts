import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common'
import type { PrismaClient } from '@jobsearch/db'
import { PRISMA } from '../prisma/prisma.module'

/**
 * Liveness that actually asks the database something.
 *
 * A health check that returns 200 because the process is running answers the
 * one question nobody needed to ask. This one reports what the pipeline has
 * produced, so a deploy that boots against an empty or unreachable database
 * says so rather than looking healthy.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get()
  async check() {
    try {
      const [jobs, live, classified] = await Promise.all([
        this.prisma.job.count(),
        this.prisma.job.count({ where: { expiresAt: null } }),
        this.prisma.jobEligibility.count(),
      ])
      return { status: 'ok', jobs, live, classified }
    } catch (error) {
      // 503 rather than 500: the service is fine, its dependency is not, and
      // that is the difference between a restart and a page.
      throw new ServiceUnavailableException({
        status: 'degraded',
        reason: error instanceof Error ? error.message : 'database unreachable',
      })
    }
  }
}
