import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load `packages/db/.env` before anything reads `process.env`.
 *
 * The Prisma CLI finds that file on its own, so `migrate` works and `verify` --
 * a plain script run by tsx in the same command -- did not. `pnpm db:migrate`
 * therefore failed at its second step unless DATABASE_URL happened to be
 * exported in the shell, which is exactly the workflow packages/db/README.md
 * documents.
 *
 * Resolved from this module rather than `process.cwd()`, and loaded before the
 * PrismaClient import, for the same reason as apps/worker/src/env.ts: the
 * client reads DATABASE_URL while it is being constructed.
 */
const here = dirname(fileURLToPath(import.meta.url))

for (const file of [resolve(here, '../.env'), resolve(here, '../../../.env')]) {
  // `loadEnvFile` throws rather than no-opping, and a missing file is the
  // normal case in CI, which injects real environment variables instead.
  if (existsSync(file)) process.loadEnvFile(file)
}
