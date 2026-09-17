import { Body, Controller, Get, HttpCode, Logger, Post, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { User } from '@jobsearch/db'
import {
  changePasswordRequestSchema,
  emailTokenRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from '@jobsearch/shared'
import { parseBody } from '../common/parse-body'
import { Limit } from '../rate-limit/rate-limit'
import { AuthService, toSessionUser } from './auth.service'
import { CurrentUser, SessionGuard, SessionToken } from './session.guard'
import { SessionsService } from './sessions.service'

/** Throttled at the controller, so the limit is checked before the session guard or any work. */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly logger = new Logger('AuthController')

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('register')
  @Limit.register()
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

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() body: unknown) {
    return this.auth.verifyEmail(parseBody(emailTokenRequestSchema, body).token)
  }

  @Post('verify-email/resend')
  @Limit.resendVerification()
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async resendVerification(@CurrentUser() user: User) {
    await this.auth.resendVerification(user)
  }

  /** Always 204, and before any lookup: see `AuthService.sendPasswordReset`. */
  @Post('password/forgot')
  @Limit.forgotPassword()
  @HttpCode(204)
  forgotPassword(@Body() body: unknown) {
    const { email } = parseBody(forgotPasswordRequestSchema, body)
    this.auth.sendPasswordReset(email).catch((error: unknown) => {
      this.logger.error(`password reset email failed: ${String(error)}`)
    })
  }

  @Post('password/reset')
  @HttpCode(200)
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(parseBody(resetPasswordRequestSchema, body))
  }

  @Post('password/change')
  @HttpCode(204)
  @Limit.changePassword()
  @UseGuards(SessionGuard)
  async changePassword(@CurrentUser() user: User, @SessionToken() token: string, @Body() body: unknown) {
    await this.auth.changePassword(user, token, parseBody(changePasswordRequestSchema, body))
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: User) {
    return toSessionUser(user)
  }
}
