import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

/**
 * The API service (PLAN.md D2, D5).
 *
 * It owns all business logic and is the only thing that touches the database.
 * `apps/web` is a BFF that talks to it over HTTP and never imports
 * `@jobsearch/db` — a rule dependency-cruiser enforces, so that adding a second
 * surface later means writing a client, not re-implementing the domain.
 *
 * Run with the SWC loader rather than tsx. Nest's dependency injection reads
 * constructor parameter types out of `emitDecoratorMetadata`, which esbuild --
 * and therefore tsx -- does not emit. Nothing errors when it is missing: the
 * container simply hands every constructor `undefined` and the failure surfaces
 * later as a null dereference. See apps/api/README.md.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()

  const port = Number(process.env.API_PORT ?? 3001)
  await app.listen(port)
  console.log(`api listening on http://localhost:${port}`)
}

await bootstrap()
