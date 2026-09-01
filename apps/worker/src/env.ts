import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load local env files before anything reads `process.env`.
 *
 * `@jobsearch/db` constructs its PrismaClient at import time, and that reads
 * DATABASE_URL there and then. ESM evaluates imports in order, so this module
 * only works if `cli.ts` imports it *first* -- see the note there.
 *
 * Resolved from this file rather than `process.cwd()`: the worker is run from
 * the repo root, from `apps/worker`, and from a worktree, and all three must
 * find the same files.
 *
 * `process.loadEnvFile` (Node >= 20.12) does not overwrite variables that are
 * already set, which gives the precedence we want for free: a variable
 * exported in the shell, or injected by CI, beats any file. Among the files,
 * the most specific one wins because it is loaded first.
 */
const here = dirname(fileURLToPath(import.meta.url))

const ENV_FILES = [
  resolve(here, '../.env'), // apps/worker/.env  -- this app's own secrets
  resolve(here, '../../../.env'), // repo root .env -- shared across apps
]

for (const file of ENV_FILES) {
  // loadEnvFile throws ENOENT rather than no-opping, and a missing file is the
  // normal case (CI injects real environment variables instead).
  if (existsSync(file)) process.loadEnvFile(file)
}
