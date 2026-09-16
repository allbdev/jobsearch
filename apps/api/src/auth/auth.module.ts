import { Module } from '@nestjs/common'
import { AuthTokensService } from './auth-tokens.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OAuthController } from './oauth/oauth.controller'
import { OAuthService } from './oauth/oauth.service'
import { SessionGuard } from './session.guard'
import { SessionsService } from './sessions.service'

/** Exports the guard and what it needs, so any feature module can require a user. */
@Module({
  controllers: [AuthController, OAuthController],
  providers: [AuthService, AuthTokensService, OAuthService, SessionsService, SessionGuard],
  exports: [SessionsService, SessionGuard],
})
export class AuthModule {}
