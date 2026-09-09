import { Global, Module } from '@nestjs/common'
import { prisma } from '@jobsearch/db'

/**
 * The database client, as an injectable rather than an import.
 *
 * `@jobsearch/db` already exports a single client for the process, so this adds
 * no connection pooling or lifecycle -- it exists so that services declare the
 * database as a dependency instead of reaching for a module-level singleton.
 * That is what makes them testable with a stub later.
 *
 * Global, because every feature module needs it and threading an import
 * through each one buys nothing.
 */
export const PRISMA = Symbol('PRISMA')

@Global()
@Module({
  providers: [{ provide: PRISMA, useValue: prisma }],
  exports: [PRISMA],
})
export class PrismaModule {}
