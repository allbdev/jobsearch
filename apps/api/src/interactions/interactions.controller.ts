import { Body, Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from '@nestjs/common'
import type { User } from '@jobsearch/db'
import { setInteractionRequestSchema } from '@jobsearch/shared'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { parseBody } from '../common/parse-body'
import { InteractionsService } from './interactions.service'

/** What the signed-in reader did with jobs. Only ever their own. */
@Controller()
@UseGuards(SessionGuard)
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Put('jobs/:id/interaction')
  set(@CurrentUser() user: User, @Param('id') jobId: string, @Body() body: unknown) {
    return this.interactions.set(user, jobId, parseBody(setInteractionRequestSchema, body).status)
  }

  @Delete('jobs/:id/interaction')
  @HttpCode(204)
  async clear(@CurrentUser() user: User, @Param('id') jobId: string) {
    await this.interactions.clear(user, jobId)
  }

  @Get('profile/history')
  history(@CurrentUser() user: User) {
    return this.interactions.history(user)
  }
}
