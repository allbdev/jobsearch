import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SessionGuard } from './session.guard'
import { SessionsService } from './sessions.service'

/** Exports the guard and what it needs, so any feature module can require a user. */
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionsService, SessionGuard],
  exports: [SessionsService, SessionGuard],
})
export class AuthModule {}
