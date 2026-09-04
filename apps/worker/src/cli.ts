// Must come first: it populates process.env, and the very next import builds a
// PrismaClient that reads DATABASE_URL during its own evaluation.
import './env'

import { prisma } from '@jobsearch/db'
import { fetchSource } from './fetch-source'
import { seed } from './seed'
import { formatHealth, isUnhealthy, sourceHealth } from './health'
import { normalizePostings } from './normalize'
import { classifyJobs } from './classify'
import { classifyByLlm, estimateCostUsd } from './classify-llm'
import { assignJobFamilies } from './job-families'
import { log } from './log'

/**
 * Commands, not a queue.
 *
 * PLAN.md D8 picks pg-boss, and §4 requires the queue to stay a clean process
 * boundary so the fetcher can be rewritten in Go later. That boundary is
 * already here — `fetchSource` takes a slug and returns counts, with no
 * knowledge of how it was invoked — but the queue itself earns its place when
 * there is more than one source to schedule. Adding it now would be machinery
 * ahead of need.
 */
async function main() {
  const [command, argument] = process.argv.slice(2)

  switch (command) {
    case 'seed':
      await seed()
      break

    case 'fetch': {
      if (!argument) throw new Error('usage: worker fetch <source-slug>')
      const started = Date.now()
      const result = await fetchSource(argument)
      log('fetch complete', { source: argument, ...result, ms: Date.now() - started })
      break
    }

    case 'normalize': {
      const started = Date.now()
      // `--all` re-runs over postings that already produced a job, which is how
      // an improved normaliser reaches data it has already processed.
      const reprocess = process.argv.includes('--all')
      const slug = argument === '--all' ? undefined : argument
      const result = await normalizePostings({ slug, reprocess })
      log('normalize complete', {
        source: slug ?? 'all',
        reprocess,
        ...result,
        ms: Date.now() - started,
      })
      break
    }

    case 'classify': {
      const started = Date.now()

      // The paid pass is opt-in. `classify` alone stays free, so the habit of
      // re-running it after a rules change costs nothing.
      if (process.argv.includes('--llm')) {
        const limitFlag = process.argv.find((arg) => arg.startsWith('--limit='))
        const result = await classifyByLlm({
          limit: limitFlag ? Number(limitFlag.split('=')[1]) : undefined,
          reprocess: process.argv.includes('--all'),
        })
        log('llm classify complete', {
          ...result,
          usd: Number(estimateCostUsd(result).toFixed(4)),
          ms: Date.now() - started,
        })
        break
      }

      const result = await classifyJobs({ reprocess: process.argv.includes('--all') })

      // Always, on every classify run. It is free, and re-running it is how a
      // taxonomy change reaches postings that were unnamed before.
      const families = await assignJobFamilies()
      log('job families assigned', { ...families })

      const settled = result.considered
        ? Math.round((result.decidedByRules / result.considered) * 100)
        : 0
      log('classify complete', { ...result, settledByRulesPct: settled, ms: Date.now() - started })
      break
    }

    case 'health': {
      const rows = await sourceHealth()
      console.log(formatHealth(rows))
      // Non-zero so a scheduler or CI job can act on it rather than needing a
      // human to read the output.
      if (isUnhealthy(rows)) process.exitCode = 1
      break
    }

    default:
      console.error('usage: worker <seed | fetch <slug> | normalize [slug] [--all] | classify [--all] [--llm] [--limit=N] | health>')
      process.exitCode = 1
  }
}

main()
  .catch((error) => {
    log('failed', { error: String(error) })
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
