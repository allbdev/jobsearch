import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common'
import { feedSortSchema } from '@jobsearch/shared'
import { FeedsService } from './feeds.service'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Unauthenticated for now: there is no auth yet, so anyone holding a feed id
 * can read it. Ids are unguessable cuids and the API is not deployed; the auth
 * PR adds the ownership check here.
 */
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get(':id')
  get(@Param('id') id: string, @Query('sort') sort?: string, @Query('limit') limit?: string) {
    const parsedSort = feedSortSchema.safeParse(sort ?? 'best_match')
    if (!parsedSort.success) throw new BadRequestException(`unknown sort: ${sort}`)

    const take = limit === undefined ? DEFAULT_LIMIT : Number(limit)
    if (!Number.isInteger(take) || take < 1 || take > MAX_LIMIT) {
      throw new BadRequestException(`limit must be an integer from 1 to ${MAX_LIMIT}`)
    }

    return this.feeds.result(id, parsedSort.data, take)
  }
}
