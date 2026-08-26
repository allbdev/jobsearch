import { prisma } from '@jobsearch/db'
import { fetchSource } from './fetch-source'
import { seed } from './seed'
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

    default:
      console.error('usage: worker <seed|fetch <source-slug>>')
      process.exitCode = 1
  }
}

main()
  .catch((error) => {
    log('failed', { error: String(error) })
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
