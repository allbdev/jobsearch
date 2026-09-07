import { prisma } from '@jobsearch/db'
import { GREENHOUSE_DEFAULT_BASE_URL, LEVER_DEFAULT_BASE_URL } from '@jobsearch/sources'
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
  // Candidates chosen by hiring model rather than size, after the first corpus
  // produced 16 postings open to Brazil out of 1,797. Toptal supplied half of
  // those from 20 postings while Cloudflare supplied none from 330, so the
  // useful question is not "is this company large" but "does this company hire
  // across borders". These are companies that say they do, or whose business is
  // helping others do it.
  'remotecom',
  'canonical',
  'elastic',
  'grafanalabs',
  'mozilla',
  'wikimedia',
  'turing',
  'consensys',
  'status',
  'vercel',
  'tailscale',
  'fastly',
  'planetscale',
  'circleci',
  'ghost',
]

/**
 * Lever boards. Same curation rule as above -- companies that publicly hire
 * remote across borders -- and the same honesty about it being a seed.
 *
 * Lever needs a display name per board because the company appears nowhere in
 * the posting: the board is the company.
 */
const LEVER_BOARDS = [
  { slug: 'toptal', name: 'Toptal' },
  { slug: 'gohighlevel', name: 'HighLevel' },
  { slug: 'voltus', name: 'Voltus' },
  { slug: 'veeva', name: 'Veeva Systems' },
  { slug: 'spotify', name: 'Spotify' },
]

export async function seed() {
  const source = await prisma.source.upsert({
    where: { slug: 'greenhouse' },
    create: {
      slug: 'greenhouse',
      kind: 'ats',
      name: 'Greenhouse job boards',
      config: { boards: GREENHOUSE_BOARDS, baseUrl: GREENHOUSE_DEFAULT_BASE_URL },
      pollIntervalMinutes: 360,
    },
    // Re-seeding refreshes the board list without resetting health counters.
    update: { config: { boards: GREENHOUSE_BOARDS, baseUrl: GREENHOUSE_DEFAULT_BASE_URL } },
  })
  log('source seeded', { slug: source.slug, boards: GREENHOUSE_BOARDS.length })

  const leverConfig = { boards: LEVER_BOARDS, baseUrl: LEVER_DEFAULT_BASE_URL }
  const lever = await prisma.source.upsert({
    where: { slug: 'lever' },
    create: {
      slug: 'lever',
      kind: 'ats',
      name: 'Lever job boards',
      config: leverConfig,
      pollIntervalMinutes: 360,
    },
    update: { config: leverConfig },
  })
  log('source seeded', { slug: lever.slug, boards: LEVER_BOARDS.length })
}
