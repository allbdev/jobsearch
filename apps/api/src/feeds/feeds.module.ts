import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { FeedsController } from './feeds.controller'
import { FeedsService } from './feeds.service'

@Module({ imports: [AuthModule], controllers: [FeedsController], providers: [FeedsService] })
export class FeedsModule {}
