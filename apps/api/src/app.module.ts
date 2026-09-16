import { Module } from '@nestjs/common'
import { FeedsModule } from './feeds/feeds.module'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({ imports: [PrismaModule, HealthModule, FeedsModule] })
export class AppModule {}
