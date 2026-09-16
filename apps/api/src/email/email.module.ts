import { Global, Module } from '@nestjs/common'
import { Mailer } from './mailer'

@Global()
@Module({
  providers: [{ provide: Mailer, useFactory: () => Mailer.fromEnv() }],
  exports: [Mailer],
})
export class EmailModule {}
