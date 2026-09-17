import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, UseGuards } from '@nestjs/common'
import type { User } from '@jobsearch/db'
import { deleteAccountRequestSchema, oauthProviderSchema } from '@jobsearch/shared'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { parseBody } from '../common/parse-body'
import { Limit } from '../rate-limit/rate-limit'
import { AccountService } from './account.service'

/** The signed-in person's own account. There is no route to anyone else's. */
@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.account.summary(user)
  }

  @Delete('connections/:provider')
  @HttpCode(204)
  async unlink(@CurrentUser() user: User, @Param('provider') provider: string) {
    const parsed = oauthProviderSchema.safeParse(provider)
    if (!parsed.success) throw new BadRequestException(`unknown provider: ${provider}`)
    await this.account.unlink(user, parsed.data)
  }

  @Delete()
  @HttpCode(204)
  // Checks a password, so it is a guessing surface for whoever holds a session.
  @Limit.changePassword()
  async remove(@CurrentUser() user: User, @Body() body: unknown) {
    await this.account.remove(user, parseBody(deleteAccountRequestSchema, body))
  }
}
