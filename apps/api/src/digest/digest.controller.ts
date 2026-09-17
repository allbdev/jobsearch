import { Body, Controller, HttpCode, Inject, NotFoundException, Post } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { UseGuards } from '@nestjs/common'
import type { PrismaClient } from '@jobsearch/db'
import { unsubscribeRequestSchema } from '@jobsearch/shared'
import { parseBody } from '../common/parse-body'
import { PRISMA } from '../prisma/prisma.module'
import { Limit } from '../rate-limit/rate-limit'

/**
 * Unsubscribing, from a link in an email.
 *
 * Deliberately unauthenticated: it has to work from a mail client with no
 * session, months later, which is the whole point of one-click unsubscribe
 * (PLAN.md §7). The token is the credential -- random per profile (#81), and it
 * can do nothing but this.
 */
@Controller('digest')
@UseGuards(ThrottlerGuard)
export class DigestController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Post('unsubscribe')
  @HttpCode(204)
  @Limit.unsubscribe()
  async unsubscribe(@Body() body: unknown) {
    const { token } = parseBody(unsubscribeRequestSchema, body)
    // Idempotent by nature: a second click sets `off` again. A token nobody
    // holds is a 404 so the page can say the link is not recognised rather than
    // claiming to have done something.
    const { count } = await this.prisma.profile.updateMany({
      where: { unsubscribeToken: token },
      data: { digestCadence: 'off' },
    })
    if (count === 0) throw new NotFoundException({ message: 'unknown unsubscribe link', reason: 'unknown_token' })
  }
}
