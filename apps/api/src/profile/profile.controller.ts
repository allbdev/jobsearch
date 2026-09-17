import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import type { User } from '@jobsearch/db'
import { profileInputSchema } from '@jobsearch/shared'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { parseBody } from '../common/parse-body'
import { ProfileService } from './profile.service'

/** The signed-in user's own profile. There is no route to anyone else's. */
@Controller('profile')
@UseGuards(SessionGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.profiles.get(user)
  }

  @Put()
  put(@CurrentUser() user: User, @Body() body: unknown) {
    return this.profiles.put(user, parseBody(profileInputSchema, body))
  }
}
