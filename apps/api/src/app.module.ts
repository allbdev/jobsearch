import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { EmailModule } from './email/email.module'
import { FeedsModule } from './feeds/feeds.module'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProfileModule } from './profile/profile.module'
import { RATE_LIMITS } from './rate-limit/rate-limit'

@Module({
  imports: [
    ThrottlerModule.forRoot(RATE_LIMITS),
    PrismaModule,
    EmailModule,
    HealthModule,
    AuthModule,
    FeedsModule,
    ProfileModule,
  ],
})
export class AppModule {}
