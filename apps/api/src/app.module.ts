import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { FeedsModule } from './feeds/feeds.module'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({ imports: [PrismaModule, HealthModule, AuthModule, FeedsModule] })
export class AppModule {}
