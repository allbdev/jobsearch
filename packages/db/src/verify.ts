import { prisma } from './index'

/**
 * Asserts that the database objects Prisma cannot see are actually present.
 *
 * Prisma diffs indexes against `schema.prisma`. Anything created in raw SQL --
 * the HNSW index on `jobs.embedding`, the GIN index on `jobs.searchVector` --
 * is invisible to it, so it reads them as drift and drops them in the next
 * migration. That happened, silently, and only turned up because the index list
 * was checked by hand afterwards.
 *
 * Triggers and CHECK constraints survive, because Prisma does not diff those.
 * They are asserted here anyway: the cost is one query and the failure mode is
 * the same kind of silence.
 */

const REQUIRED_INDEXES = [
  { table: 'jobs', name: 'jobs_search_vector_idx' },
  { table: 'jobs', name: 'jobs_embedding_idx' },
  { table: 'companies', name: 'companies_name_lower_idx' },
] as const

const REQUIRED_TRIGGERS = ['jobs_search_vector_trigger'] as const
const REQUIRED_CONSTRAINTS = ['job_eligibility_confirmed_needs_evidence'] as const

export async function verifySchema(): Promise<string[]> {
  const problems: string[] = []

  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  `
  const present = new Set(indexes.map((row) => row.indexname))
  for (const index of REQUIRED_INDEXES) {
    if (!present.has(index.name)) {
      problems.push(`missing index ${index.name} on ${index.table} — a migration dropped it`)
    }
  }

  const triggers = await prisma.$queryRaw<{ tgname: string }[]>`
    SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
  `
  const triggerNames = new Set(triggers.map((row) => row.tgname))
  for (const name of REQUIRED_TRIGGERS) {
    if (!triggerNames.has(name)) problems.push(`missing trigger ${name}`)
  }

  const constraints = await prisma.$queryRaw<{ conname: string }[]>`
    SELECT conname FROM pg_constraint
  `
  const constraintNames = new Set(constraints.map((row) => row.conname))
  for (const name of REQUIRED_CONSTRAINTS) {
    if (!constraintNames.has(name)) problems.push(`missing constraint ${name}`)
  }

  return problems
}

// Run directly: `pnpm db:verify`
if (process.argv[1]?.endsWith('verify.ts')) {
  verifySchema()
    .then((problems) => {
      if (problems.length === 0) {
        console.log('✓ schema objects present: indexes, triggers, constraints')
        return
      }
      for (const problem of problems) console.error(`✗ ${problem}`)
      console.error(
        '\nRaw-SQL objects are dropped by Prisma migrations. Re-create them in the migration that dropped them.',
      )
      process.exitCode = 1
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
