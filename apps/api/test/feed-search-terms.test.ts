import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { feedWhere, prisma } from '@jobsearch/db'
import { feedDefinitionInputSchema } from '@jobsearch/shared'

/**
 * Against real Postgres, and scoped to seeded rows: the point of the feature is
 * finding work described in a posting whose title never says it.
 */
const run = randomUUID().slice(0, 8)
const NOW = new Date()
const ids = new Map<string, string>()
let companyId: string

const DEFAULTS = {
  searchTerms: [] as string[],
  jobFamilies: [] as string[],
  eligibleFrom: [] as string[],
  contractModels: [] as never[],
  freshnessDays: null,
  hideRejected: true,
}

async function matching(searchTerms: string[], jobFamilies: string[] = []) {
  const rows = await prisma.job.findMany({
    where: { AND: [feedWhere({ ...DEFAULTS, searchTerms, jobFamilies }, null, NOW), { id: { in: [...ids.values()] } }] },
    select: { id: true },
  })
  const byId = new Map([...ids].map(([key, id]) => [id, key]))
  return rows.map((row) => byId.get(row.id)).sort()
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('a feed’s own search terms', () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `search-terms-${run}` } })).id
    const seeds = [
      // The case this exists for: React work in a posting titled otherwise.
      { key: 'fullstack', title: 'Senior Software Engineer', description: 'You will work in React and Node.', skills: ['TypeScript'], family: 'engineering-fullstack' },
      { key: 'titled', title: 'Frontend Engineer, React', description: 'Build the web app.', skills: [], family: 'engineering-frontend' },
      // Its skills say React; its text never does. Nothing fills `skills` today.
      { key: 'skills-only', title: 'Product Engineer', description: 'Own features end to end.', skills: ['React', 'Go'], family: 'engineering-fullstack' },
      { key: 'backend', title: 'Backend Engineer', description: 'Postgres, Go, and queues.', skills: ['Go'], family: 'engineering-backend' },
      { key: 'staff-react', title: 'Staff Engineer', description: 'React platform work.', skills: [], family: 'engineering-platform' },
    ]
    for (const seed of seeds) {
      const job = await prisma.job.create({
        data: {
          companyId,
          title: seed.title,
          description: seed.description,
          skills: seed.skills,
          jobFamily: seed.family,
          applyUrl: `https://example.test/${run}/${seed.key}`,
          postedAt: NOW,
          contentHash: `search-terms-${run}-${seed.key}`,
          eligibility: {
            create: {
              verdict: 'confirmed',
              regionLabel: 'Worldwide',
              eligibleRegions: ['Worldwide'],
              evidenceSnippet: 'Open to candidates anywhere.',
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

  it('finds the work wherever the posting mentions it — in the title or the body', async () => {
    expect(await matching(['react'])).toEqual(['fullstack', 'staff-react', 'titled'])
  })

  it('does not answer for a skill the posting never mentions', async () => {
    // Not an oversight: no adapter fills `jobs.skills`, so searching it could
    // only ever match nothing. The day something does, this test should change.
    expect(await matching(['react'])).not.toContain('skills-only')
    expect(await matching(['go'])).toEqual(['backend'])
  })

  it('ignores case, in the term and in the posting', async () => {
    expect(await matching(['REACT'])).toEqual(await matching(['react']))
    expect(await matching(['postgres'])).toEqual(['backend'])
  })

  it('narrows with every term added, rather than widening', async () => {
    expect(await matching(['react', 'staff'])).toEqual(['staff-react'])
    expect(await matching(['react', 'kubernetes'])).toEqual([])
  })

  it('combines with the family filter instead of replacing it', async () => {
    // The point of the feature: "react" alone finds four, and three of them are
    // not in the frontend family at all.
    expect(await matching(['react'], ['engineering-frontend'])).toEqual(['titled'])
  })

  it('matches nothing differently when no term is given', async () => {
    expect((await matching([])).length).toBe(5)
  })

  it('lower-cases, de-duplicates and caps what a client may send', async () => {
    const parsed = feedDefinitionInputSchema.parse({
      name: 'React work',
      jobFamilies: [],
      eligibleFrom: [],
      contractModels: [],
      searchTerms: [' React ', 'react', 'TYPESCRIPT'],
      minCompensation: null,
      currency: 'USD',
      freshnessDays: null,
      hideRejected: true,
    })
    expect(parsed.searchTerms).toEqual(['react', 'typescript'])

    const tooMany = { searchTerms: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'], name: 'x', jobFamilies: [], eligibleFrom: [], contractModels: [], minCompensation: null, currency: 'USD', freshnessDays: null, hideRejected: true }
    expect(feedDefinitionInputSchema.safeParse(tooMany).success).toBe(false)
    expect(feedDefinitionInputSchema.safeParse({ ...tooMany, searchTerms: ['a'] }).success).toBe(false)
  })
})
