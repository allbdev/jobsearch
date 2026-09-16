import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import type { User } from '@jobsearch/db'
import { feedDefinitionInputSchema, feedSortSchema } from '@jobsearch/shared'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { parseBody } from '../common/parse-body'
import { FeedsService } from './feeds.service'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/** A feed is its owner's: every route needs a session and sees only that user's feeds. */
@Controller('feeds')
@UseGuards(SessionGuard)
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.feeds.list(user)
  }

  @Get(':id')
  get(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedSort = feedSortSchema.safeParse(sort ?? 'best_match')
    if (!parsedSort.success) throw new BadRequestException(`unknown sort: ${sort}`)

    const take = limit === undefined ? DEFAULT_LIMIT : Number(limit)
    if (!Number.isInteger(take) || take < 1 || take > MAX_LIMIT) {
      throw new BadRequestException(`limit must be an integer from 1 to ${MAX_LIMIT}`)
    }

    return this.feeds.result(id, user, parsedSort.data, take)
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.feeds.create(user, parseBody(feedDefinitionInputSchema, body))
  }

  @Put(':id')
  replace(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    return this.feeds.replace(id, user, parseBody(feedDefinitionInputSchema, body))
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.feeds.remove(id, user)
  }
}
