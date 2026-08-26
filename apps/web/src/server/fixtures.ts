import type { ContractModel, Feed, FeedResult, HistoryEntry, Job, Profile } from '@jobsearch/shared'

/**
 * Fixture data lifted from the Claude Design prototype (`Feed.dc.html`,
 * `Profile.dc.html`) and re-typed against the real domain schemas.
 *
 * This exists only until `apps/api` serves the same shapes. Typing it against
 * `@jobsearch/shared` rather than ad-hoc objects means the screens are already
 * built against the production contract — when the API lands, only
 * `api-client.ts` changes.
 */

const DAY = 86_400_000

const daysAgo = (now: number, days: number) => new Date(now - days * DAY).toISOString()

interface Seed {
  id: string
  title: string
  company: string
  verdict: 'confirmed' | 'needs_check'
  region: string
  contract: ContractModel
  skills: string[]
  salary: string
  days: number
  source: Job['source']
  evidence: string
  verifiedDays: number
  classifier: string
}

const FEED_SEEDS: { feed: Omit<Feed, 'matchedCount'>; jobs: Seed[] }[] = [
  {
    feed: {
      id: 'frontend-worldwide',
      definition: {
        name: 'Frontend · Worldwide',
        jobFamilies: ['engineering-frontend', 'engineering-fullstack'],
        eligibleFrom: ['Worldwide', 'LATAM', 'Americas'],
        contractModels: ['contractor_pj', 'eor'],
        minCompensation: 90_000,
        currency: 'USD',
        freshnessDays: 30,
        hideRejected: true,
      },
    },
    jobs: [
      { id: '1', title: 'Senior Frontend Engineer', company: 'Layered', verdict: 'confirmed', region: 'Worldwide', contract: 'contractor_pj', skills: ['React', 'TypeScript', 'Next.js'], salary: '$120–150k USD', days: 2, source: 'greenhouse', evidence: 'This role is open to candidates anywhere in the world. We hire contractors directly or via Deel.', verifiedDays: 0, classifier: 'v14' },
      { id: '2', title: 'Fullstack Engineer', company: 'Driftwood Systems', verdict: 'confirmed', region: 'Americas', contract: 'contractor_pj', skills: ['Node.js', 'PostgreSQL', 'React'], salary: '$100–130k USD', days: 3, source: 'lever', evidence: 'Open to remote candidates across the Americas. Async-first; 3h overlap with EST required.', verifiedDays: 0, classifier: 'v14' },
      { id: '3', title: 'Product Engineer', company: 'Fathom Analytics', verdict: 'needs_check', region: 'Remote', contract: 'unknown', skills: ['TypeScript', 'React', 'Go'], salary: '$110–140k USD', days: 1, source: 'wwr', evidence: 'Posting says only "Remote" — no residence or region requirement found. Ask whether they hire outside the US.', verifiedDays: 0, classifier: 'v14' },
      { id: '4', title: 'Frontend Engineer, Design Systems', company: 'Northbeam', verdict: 'confirmed', region: 'LATAM', contract: 'eor', skills: ['React', 'Storybook', 'CSS'], salary: '$85–105k USD', days: 5, source: 'ashby', evidence: 'We are hiring across Latin America through our EOR partner Oyster.', verifiedDays: 1, classifier: 'v14' },
      { id: '5', title: 'Senior Fullstack Engineer (Go/React)', company: 'Hatchline', verdict: 'confirmed', region: 'Worldwide', contract: 'contractor_pj', skills: ['Go', 'React', 'AWS'], salary: '$130–160k USD', days: 6, source: 'hn_whoishiring', evidence: 'REMOTE (worldwide, contractor OK). We have teammates in 14 countries.', verifiedDays: 0, classifier: 'v13' },
      { id: '6', title: 'React Native Engineer', company: 'Moventra', verdict: 'needs_check', region: 'Remote', contract: 'unknown', skills: ['React Native', 'TypeScript'], salary: 'Not listed', days: 4, source: 'remotive', evidence: 'Category is "Remote" with no country metadata on the source. Eligibility must be confirmed with the company.', verifiedDays: 0, classifier: 'v14' },
      { id: '7', title: 'Staff Frontend Engineer', company: 'Quarry', verdict: 'confirmed', region: 'Brazil listed', contract: 'local_entity', skills: ['React', 'Next.js', 'GraphQL'], salary: 'R$25–32k/mo', days: 7, source: 'greenhouse', evidence: 'Eligible countries for this position include Brazil, Argentina, Colombia and Mexico.', verifiedDays: 2, classifier: 'v14' },
    ],
  },
  {
    feed: {
      id: 'design-latam',
      definition: {
        name: 'Product Design · LATAM',
        jobFamilies: ['design-product', 'design-research'],
        eligibleFrom: ['LATAM', 'Brazil listed'],
        contractModels: ['contractor_pj', 'eor', 'local_entity'],
        minCompensation: 60_000,
        currency: 'USD',
        freshnessDays: 30,
        hideRejected: true,
      },
    },
    jobs: [
      { id: '8', title: 'Senior Product Designer', company: 'Northbeam', verdict: 'confirmed', region: 'LATAM', contract: 'eor', skills: ['Figma', 'Design systems'], salary: '$70–90k USD', days: 3, source: 'ashby', evidence: 'We are hiring across Latin America through our EOR partner Oyster.', verifiedDays: 0, classifier: 'v14' },
      { id: '9', title: 'Product Designer, Growth', company: 'Helio', verdict: 'needs_check', region: 'Remote', contract: 'unknown', skills: ['Figma', 'Prototyping'], salary: 'Not listed', days: 2, source: 'dribbble', evidence: 'Posting says only "Remote" — no residence requirement found.', verifiedDays: 0, classifier: 'v14' },
      { id: '10', title: 'UX Designer', company: 'Terraform Labs', verdict: 'confirmed', region: 'Worldwide', contract: 'contractor_pj', skills: ['Research', 'Figma'], salary: '$65–85k USD', days: 7, source: 'remotive', evidence: 'This position is fully remote and open worldwide.', verifiedDays: 1, classifier: 'v13' },
    ],
  },
  {
    feed: {
      id: 'anything-brazil',
      definition: {
        name: 'Anything · Brazil-eligible',
        jobFamilies: [],
        eligibleFrom: ['Brazil listed'],
        contractModels: ['contractor_pj', 'eor', 'local_entity', 'employee_relocation'],
        minCompensation: null,
        currency: 'USD',
        freshnessDays: 30,
        hideRejected: true,
      },
    },
    jobs: [
      { id: '11', title: 'Customer Support Lead', company: 'Fathom Analytics', verdict: 'confirmed', region: 'Worldwide', contract: 'contractor_pj', skills: ['Zendesk', 'English C1'], salary: '$45–60k USD', days: 1, source: 'supportdriven', evidence: 'Work from anywhere — we hire globally as contractors.', verifiedDays: 0, classifier: 'v14' },
      { id: '12', title: 'Senior Accountant', company: 'Oyster HR', verdict: 'confirmed', region: 'LATAM', contract: 'eor', skills: ['IFRS', 'NetSuite'], salary: '$55–70k USD', days: 4, source: 'greenhouse', evidence: 'This role can be performed from anywhere in Latin America.', verifiedDays: 0, classifier: 'v14' },
      { id: '13', title: 'Growth Marketer', company: 'Jobicy client', verdict: 'needs_check', region: 'Remote', contract: 'unknown', skills: ['SEO', 'Content'], salary: 'Not listed', days: 5, source: 'jobicy', evidence: 'Source has no region metadata; the posting text says "remote team" only.', verifiedDays: 0, classifier: 'v14' },
      { id: '14', title: 'Technical Writer', company: 'Basalt Docs', verdict: 'confirmed', region: 'Americas', contract: 'contractor_pj', skills: ['Docs-as-code', 'English'], salary: '$60–75k USD', days: 6, source: 'wwr', evidence: 'Remote — Americas. We contract internationally via Remote.com.', verifiedDays: 0, classifier: 'v14' },
    ],
  },
]

function toJob(seed: Seed, now: number, family: string): Job {
  return {
    id: seed.id,
    title: seed.title,
    company: seed.company,
    applyUrl: `https://example.com/jobs/${seed.id}`,
    jobFamily: family,
    skills: seed.skills,
    compensation: { min: null, max: null, currency: null, period: 'year', label: seed.salary },
    postedAt: daysAgo(now, seed.days),
    source: seed.source,
    eligibility: {
      verdict: seed.verdict,
      regionLabel: seed.region,
      eligibleCountries: [],
      contractModel: seed.contract,
      evidenceSnippet: seed.evidence,
      evidenceUrl: `https://example.com/jobs/${seed.id}`,
      classifierVersion: seed.classifier,
      linkVerifiedAt: daysAgo(now, seed.verifiedDays),
    },
  }
}

export function feeds(now: number): Feed[] {
  return FEED_SEEDS.map(({ feed, jobs }) => ({ ...feed, matchedCount: jobs.length }))
}

export function feedResult(feedId: string, now: number): FeedResult {
  const seed = FEED_SEEDS.find((entry) => entry.feed.id === feedId) ?? FEED_SEEDS[0]!
  const family = seed.feed.definition.jobFamilies[0] ?? 'All families'
  const jobs = seed.jobs.map((job) => toJob(job, now, family))

  return {
    feed: { ...seed.feed, matchedCount: jobs.length },
    jobs,
    stats: {
      evaluated: 412,
      confirmed: jobs.filter((job) => job.eligibility.verdict === 'confirmed').length,
      needsCheck: jobs.filter((job) => job.eligibility.verdict === 'needs_check').length,
      dismissedByUser: 0,
      indexUpdatedAt: new Date(now - 2 * 3_600_000).toISOString(),
    },
  }
}

export function profile(): Profile {
  return {
    residenceCountry: 'Brazil',
    timezone: 'UTC−3 · Brasília',
    targetRegions: ['USA', 'Canada', 'Europe'],
    languages: ['English', 'Português'],
    jobFamilies: ['engineering-frontend', 'engineering-fullstack'],
    targetRoles: 'Product Engineer, Frontend Engineer, Fullstack Engineer',
    seniority: 'senior',
    skills: ['JavaScript', 'TypeScript', 'React', 'Next.js', 'React Native', 'Node.js', 'NestJS', 'PostgreSQL', 'Go'],
    contractModels: ['contractor_pj', 'eor'],
    minCompensation: 90_000,
    currency: 'USD',
    email: 'ana@example.com',
    interfaceLanguage: 'English',
    digest: { cadence: 'weekly', sendOn: 'Monday', sendAt: '08:00', language: 'English' },
  }
}

export function history(): HistoryEntry[] {
  return [
    { jobId: '1', title: 'Senior Frontend Engineer', company: 'Layered', regionLabel: 'Worldwide', confirmed: true, status: 'saved', date: 'Aug 23' },
    { jobId: '4', title: 'Frontend Engineer, Design Systems', company: 'Northbeam', regionLabel: 'LATAM', confirmed: true, status: 'saved', date: 'Aug 21' },
    { jobId: '7', title: 'Staff Frontend Engineer', company: 'Quarry', regionLabel: 'Brazil', confirmed: true, status: 'saved', date: 'Aug 19' },
    { jobId: '5', title: 'Senior Fullstack Engineer', company: 'Hatchline', regionLabel: 'Worldwide', confirmed: true, status: 'applied', date: 'Aug 22' },
    { jobId: '3', title: 'Product Engineer', company: 'Fathom Analytics', regionLabel: 'Remote', confirmed: false, status: 'applied', date: 'Aug 18' },
    { jobId: '6', title: 'React Native Engineer', company: 'Moventra', regionLabel: 'Remote', confirmed: false, status: 'dismissed', date: 'Aug 24' },
    { jobId: '10', title: 'UX Designer', company: 'Terraform Labs', regionLabel: 'Worldwide', confirmed: true, status: 'dismissed', date: 'Aug 20' },
  ]
}
