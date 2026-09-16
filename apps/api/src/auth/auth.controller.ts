import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import type { User } from '@jobsearch/db'
import { loginRequestSchema, registerRequestSchema } from '@jobsearch/shared'
import { parseBody } from '../common/parse-body'
import { AuthService, toSessionUser } from './auth.service'
import { CurrentUser, SessionGuard, SessionToken } from './session.guard'
import { SessionsService } from './sessions.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('register')
  register(@Body() body: unknown) {
    return this.auth.register(parseBody(registerRequestSchema, body))
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.auth.login(parseBody(loginRequestSchema, body))
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@SessionToken() token: string) {
    await this.sessions.revoke(token)
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: User) {
    return toSessionUser(user)
  }
}
