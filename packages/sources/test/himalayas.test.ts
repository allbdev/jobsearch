import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { classifyByRules } from '@jobsearch/core'
import { himalayasAdapter, himalayasLocation } from '../src/himalayas'
import type { FetchContext, FetchedPosting } from '../src/types'

/** Two recorded pages, four real listings: Brazil, US-only, multi-country, none. */
const pages = JSON.parse(
  readFileSync(new URL('./fixtures/himalayas-pages.json', import.meta.url), 'utf8'),
) as { jobs: Record<string, unknown>[]; nextCursor: string | null }[]

function context(over: Partial<FetchContext> = {}): FetchContext {
  let page = 0
  return {
    config: { maxAgeDays: 36_500 },
    http: { getJson: async () => pages[page++] ?? { jobs: [], nextCursor: null } },
    log: () => {},
    reportFailure: () => {},
    ...over,
  }
}

async function collect(ctx: FetchContext): Promise<FetchedPosting[]> {
  const out: FetchedPosting[] = []
  for await (const posting of himalayasAdapter.fetch(ctx)) out.push(posting)
  return out
}

describe('fetch', () => {
  it('follows the cursor to the end of the feed', async () => {
    const postings = await collect(context())
    expect(postings).toHaveLength(4)
    expect(new Set(postings.map((p) => p.externalId)).size).toBe(4)
  })

  it('stops at the page budget rather than walking 102,000 listings', async () => {
    const postings = await collect(context({ config: { maxPages: 1, maxAgeDays: 36_500 } }))
    expect(postings).toHaveLength(2)
  })

  it('stops once the feed is older than the window', async () => {
    // Newest first, so an old last-listing means every later page is older.
    const old = Math.floor(Date.now() / 1000) - 30 * 86_400
    const aged = [{ jobs: pages[0]!.jobs.map((job) => ({ ...job, pubDate: old })), nextCursor: 'more' }]
    let page = 0
    const postings = await collect(
      context({
        config: { maxAgeDays: 3 },
        http: { getJson: async () => aged[page++] ?? { jobs: [], nextCursor: 'more' } },
      }),
    )
    // The page it found them on still counts — they were fetched.
    expect(postings).toHaveLength(2)
  })

  it('reports a failed page instead of reporting an empty crawl', async () => {
    const failures: string[] = []
    const postings = await collect(
      context({
        http: { getJson: async () => { throw new Error('502') } },
        reportFailure: (scope) => failures.push(scope),
      }),
    )
    expect(postings).toEqual([])
    expect(failures).toEqual(['page:0'])
  })

  it('re-fetching an unchanged listing produces the same hash', async () => {
    const [first] = await collect(context())
    const [again] = await collect(context())
    expect(first!.contentHash).toBe(again!.contentHash)
  })
})

describe('normalize', () => {
  it('reads the fields the pipeline needs', async () => {
    const [posting] = await collect(context())
    const job = himalayasAdapter.normalize(posting!.payload)

    expect(job).not.toBeNull()
    expect(job!.title.length).toBeGreaterThan(0)
    expect(job!.companyName.length).toBeGreaterThan(0)
    expect(job!.applyUrl).toMatch(/^https:\/\//)
    // Unix seconds, not milliseconds: 1970 would mean the multiplier is missing.
    expect(job!.postedAt.getUTCFullYear()).toBeGreaterThan(2020)
    // The source states no language, and inventing one is not this stage's job.
    expect(job!.language).toBeNull()
  })

  it('returns null rather than throwing on a payload it cannot read', () => {
    expect(himalayasAdapter.normalize({ title: 'No company' })).toBeNull()
    expect(himalayasAdapter.normalize(null)).toBeNull()
  })

  it('strips the HTML the source sends as a description', async () => {
    const [posting] = await collect(context())
    const job = himalayasAdapter.normalize(posting!.payload)
    expect(job!.description).not.toMatch(/<\/?(p|div|ul|li|strong)\b/)
  })
})

describe('where the employer will hire from', () => {
  it('writes the restriction the way the eligibility rules read a location', () => {
    expect(himalayasLocation(['Brazil'])).toBe('Remote — Brazil')
    expect(himalayasLocation(['Canada', 'Costa Rica'])).toBe('Remote — Canada; Costa Rica')
  })

  it('does not turn "no restriction stated" into "worldwide"', () => {
    // The difference this product exists for: nobody said it is open to
    // everyone, so it is an open question, not a promise. A bare "Remote"
    // reaches `needs_check` and shows in its own tier.
    expect(himalayasLocation([])).toBe('Remote')
    expect(himalayasLocation(null)).toBe('Remote')
    expect(classifyByRules({ title: 'Engineer', description: '', locationRaw: 'Remote' }).verdict).toBe(
      'needs_check',
    )
  })

  it('settles a country-restricted listing with the free rules', async () => {
    const postings = await collect(context())
    const brazil = postings
      .map((posting) => himalayasAdapter.normalize(posting.payload)!)
      .find((job) => job.locationRaw === 'Remote — Brazil')

    expect(brazil).toBeDefined()
    const verdict = classifyByRules({
      title: brazil!.title,
      description: brazil!.description,
      locationRaw: brazil!.locationRaw,
    })
    // Settled by `location-remote-scoped`, so this source costs nothing to
    // classify -- which is the whole reason for writing the restriction into
    // `locationRaw` in the shape the rules already read.
    expect(verdict.verdict).toBe('confirmed')
    expect(verdict.matchedRule).toBe('location-remote-scoped')
    expect(verdict.eligibleRegions).toContain('BR')
  })
})
