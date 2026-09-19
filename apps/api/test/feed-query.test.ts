import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ContractModel, EligibilityVerdict } from '@jobsearch/db'
import { prisma } from '@jobsearch/db'
import { feedOrderBy, feedWhere } from '@jobsearch/db'
import { toJob } from '../src/feeds/to-job'
import { jobSchema } from '@jobsearch/shared'

/**
 * Against a real Postgres, because the bugs this guards are in SQL: how array
 * overlap, enum ordering and NULL comparisons actually behave. CI provides the
 * database; locally, `pnpm db:up` and set DATABASE_URL. Every query is scoped to the rows seeded here,
 * so it is safe to run against a database holding a real crawl.
 */

const NOW = new Date('2026-09-16T12:00:00Z')
const DAY = 86_400_000
const run = randomUUID()

interface Seed {
  key: string
  verdict: EligibilityVerdict
  regions: string[]
  countries: string[]
  contract?: ContractModel
  family?: string | null
  daysAgo?: number
  expired?: boolean
}

const SEEDS: Seed[] = [
  { key: 'worldwide', verdict: 'confirmed', regions: ['Worldwide'], countries: [] },
  { key: 'latam', verdict: 'confirmed', regions: ['LATAM'], countries: ['AR', 'BR', 'MX'], contract: 'eor' },
  { key: 'brazil', verdict: 'confirmed', regions: ['BR'], countries: ['BR'], contract: 'contractor_pj' },
  { key: 'us', verdict: 'confirmed', regions: ['US'], countries: ['US'] },
  { key: 'unclear', verdict: 'needs_check', regions: ['US'], countries: ['US'], daysAgo: 0 },
  { key: 'onsite', verdict: 'rejected', regions: [], countries: [] },
  { key: 'gone', verdict: 'confirmed', regions: ['Worldwide'], countries: [], expired: true },
  { key: 'old', verdict: 'confirmed', regions: ['Worldwide'], countries: [], daysAgo: 90, family: null },
]

const ids = new Map<string, string>()
interface FeedFields {
  searchTerms: string[]
  jobFamilies: string[]
  eligibleFrom: string[]
  contractModels: ContractModel[]
  freshnessDays: number | null
  hideRejected: boolean
}
const DEFAULTS: FeedFields = { searchTerms: [], jobFamilies: [], eligibleFrom: [], contractModels: [], freshnessDays: null, hideRejected: true }

async function match(
  feed: Partial<FeedFields>,
  residence: string | null = null,
  sort: 'best_match' | 'newest' = 'best_match',
) {
  const rows = await prisma.job.findMany({
    where: { AND: [feedWhere({ ...DEFAULTS, ...feed }, residence, NOW), { id: { in: [...ids.values()] } }] },
    orderBy: feedOrderBy(sort),
    select: { id: true },
  })
  const byId = new Map([...ids].map(([key, id]) => [id, key]))
  return rows.map((row) => byId.get(row.id))
}

// Skipped without a database locally; never in CI, where a silent skip would
// look exactly like a pass. Turborepo strips undeclared env vars, which is how
// that nearly happened -- see `test.env` in turbo.json.
describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('feedWhere', () => {
  let companyId: string

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `feed-query-test ${run}` } })).id
    for (const [index, seed] of SEEDS.entries()) {
      const job = await prisma.job.create({
        data: {
          companyId,
          title: seed.key,
          description: seed.key === 'latam' ? 'For front end work we prefer React and Flutter.' : '',
          applyUrl: `https://example.test/${seed.key}`,
          jobFamily: seed.family === undefined ? 'engineering-frontend' : seed.family,
          // Distinct timestamps, newest first in declaration order.
          postedAt: new Date(NOW.getTime() - (seed.daysAgo ?? index + 1) * DAY + index),
          expiresAt: seed.expired ? NOW : null,
          contentHash: `${run}:${seed.key}`,
          eligibility: {
            create: {
              verdict: seed.verdict,
              regionLabel: seed.regions.join(', ') || 'Onsite',
              eligibleRegions: seed.regions,
              eligibleCountries: seed.countries,
              contractModel: seed.contract ?? 'unknown',
              evidenceSnippet: seed.verdict === 'confirmed' ? 'Open to candidates in these regions.' : null,
              classifierVersion: 'test',
            },
          },
        },
      })
      ids.set(seed.key, job.id)
    }
  })

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { companyId } })
    await prisma.company.delete({ where: { id: companyId } })
    await prisma.$disconnect()
  })

  it('shows a resident only what they can take, plus everything unverified', async () => {
    expect(await match({}, 'BR')).toEqual(['worldwide', 'latam', 'brazil', 'old', 'unclear'])
  })

  it('drops expired jobs, and rejected ones unless asked for', async () => {
    expect(await match({})).not.toContain('gone')
    expect(await match({})).not.toContain('onsite')
    expect(await match({ hideRejected: false })).toContain('onsite')
  })

  it('matches eligibleFrom as a country overlap in both directions', async () => {
    expect(await match({ eligibleFrom: ['BR'] })).toEqual(['worldwide', 'latam', 'brazil', 'old', 'unclear'])
    expect(await match({ eligibleFrom: ['LATAM'] })).toContain('brazil')
    expect(await match({ eligibleFrom: ['EU'] })).toEqual(['worldwide', 'old', 'unclear'])
  })

  it('lets contract models through when the posting does not say', async () => {
    expect(await match({ contractModels: ['eor'] }, 'BR')).toEqual(['worldwide', 'latam', 'old', 'unclear'])
  })

  it('filters by family, which excludes jobs with none assigned', async () => {
    expect(await match({ jobFamilies: ['engineering-frontend'] }, 'BR')).not.toContain('old')
  })

  it('applies an age limit only when one is set', async () => {
    expect(await match({ freshnessDays: 30 }, 'BR')).not.toContain('old')
  })

  it('ranks confirmed above needs_check for best_match, and ignores tier for newest', async () => {
    expect((await match({}, 'BR', 'newest'))[0]).toBe('unclear')
  })

  it('maps a stored job onto the wire contract', async () => {
    const row = await prisma.job.findUniqueOrThrow({
      where: { id: ids.get('latam') },
      include: { company: true, eligibility: true, rawPostings: { select: { source: { select: { slug: true } } } } },
    })
    const job = jobSchema.parse(toJob(row))
    expect(job).toMatchObject({ source: 'other', compensation: { label: '', currency: null } })
    expect(job.eligibility).toMatchObject({ verdict: 'confirmed', eligibleCountries: ['AR', 'BR', 'MX'] })
    // A feed with no terms asks no question, so there is nothing to answer.
    expect(job.termMatch).toBeUndefined()
  })

  it('says why a row answered a search term, over the wire', async () => {
    const row = await prisma.job.findUniqueOrThrow({
      where: { id: ids.get('latam') },
      include: { company: true, eligibility: true, rawPostings: { select: { source: { select: { slug: true } } } } },
    })

    // The case that made this necessary: the term is in boilerplate, not in
    // the title, and without the quote the row reads as a broken filter.
    const job = jobSchema.parse(toJob(row, ['react']))
    expect(job.termMatch).toEqual({
      term: 'react',
      snippet: 'For front end work we prefer React and Flutter.',
      field: 'description',
    })

    // Matched on a field with no sentence to quote -- `searchText` folds in
    // `skills`, so null is a real answer rather than a failure.
    expect(jobSchema.parse(toJob(row, ['kubernetes'])).termMatch).toBeNull()
  })
})
