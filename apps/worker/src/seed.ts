import { prisma } from '@jobsearch/db'
import { log } from './log'

/**
 * A starting set of Greenhouse boards.
 *
 * Curated by hand for now, which is the honest state of PLAN.md §3's "curate a
 * company list": these are companies that publicly hire remote across borders.
 * It is a seed to prove the pipeline, not the finished list.
 *
 * Board tokens go stale — `sourcegraph` and `grafana` both 404 today. That is a
 * curation problem to watch (`sources.failureStreak`), not a crash: the adapter
 * logs a dead board and carries on with the rest.
 */
const GREENHOUSE_BOARDS = [
  'gitlab',
  'doximity',
  'cloudflare',
  'discord',
  'duolingo',
]

export async function seed() {
  const source = await prisma.source.upsert({
    where: { slug: 'greenhouse' },
    create: {
      slug: 'greenhouse',
      kind: 'ats',
      name: 'Greenhouse job boards',
      config: { boards: GREENHOUSE_BOARDS },
      pollIntervalMinutes: 360,
    },
    // Re-seeding refreshes the board list without resetting health counters.
    update: { config: { boards: GREENHOUSE_BOARDS } },
  })
  log('source seeded', { slug: source.slug, boards: GREENHOUSE_BOARDS.length })
}
