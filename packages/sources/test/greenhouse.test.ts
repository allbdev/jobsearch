import { describe, expect, it, vi } from 'vitest'
import { greenhouseAdapter, greenhouseContentHash } from '../src/greenhouse'
import { SourceConfigError, type FetchContext, type HttpClient } from '../src/types'
import fixture from './fixtures/greenhouse-board.json'

/** Replays a recorded board response — no network, no flakiness, no rate limit. */
function httpReturning(byUrl: Record<string, unknown>): HttpClient {
  return {
    getJson: vi.fn(async (url: string) => {
      if (!(url in byUrl)) throw new Error(`unexpected URL: ${url}`)
      const value = byUrl[url]
      if (value instanceof Error) throw value
      return value
    }),
  }
}

const URL_FOR = (board: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`

function contextWith(
  http: HttpClient,
  config: unknown,
): FetchContext & { logs: unknown[]; failures: unknown[] } {
  const logs: unknown[] = []
  const failures: unknown[] = []
  return {
    config,
    http,
    log: (m, d) => {
      logs.push([m, d])
    },
    reportFailure: (scope, error) => {
      failures.push([scope, String(error)])
    },
    logs,
    failures,
  }
}

async function collect(iterable: AsyncIterable<unknown>) {
  const out = []
  for await (const item of iterable) out.push(item)
  return out
}

describe('greenhouse adapter', () => {
  it('yields one posting per job on the board', async () => {
    const ctx = contextWith(httpReturning({ [URL_FOR('acme')]: fixture }), { boards: ['acme'] })
    const postings = await collect(greenhouseAdapter.fetch(ctx))

    expect(postings).toHaveLength(fixture.jobs.length)
    expect(postings[0]).toMatchObject({
      externalId: `acme:${fixture.jobs[0]!.id}`,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  })

  it('namespaces externalId by board, because Greenhouse ids collide across companies', async () => {
    const ctx = contextWith(
      httpReturning({ [URL_FOR('acme')]: fixture, [URL_FOR('globex')]: fixture }),
      { boards: ['acme', 'globex'] },
    )
    const ids = (await collect(greenhouseAdapter.fetch(ctx))).map((p: any) => p.externalId)

    expect(new Set(ids).size).toBe(ids.length)
    const firstId = fixture.jobs[0]!.id
    expect(ids).toContain(`acme:${firstId}`)
    expect(ids).toContain(`globex:${firstId}`)
  })

  it('keeps the payload exactly as received', async () => {
    const ctx = contextWith(httpReturning({ [URL_FOR('acme')]: fixture }), { boards: ['acme'] })
    const [first] = await collect(greenhouseAdapter.fetch(ctx))

    // `normalize` and `classify` replay from this, so anything dropped here is
    // gone for good.
    expect((first as any).payload).toEqual(fixture.jobs[0]!)
  })

  it('keeps fields the schema does not name', async () => {
    // Regression: Zod strips unknown keys unless the schema passes them
    // through, and the parsed object is what becomes `payload`. This silently
    // discarded company_name, first_published and language -- the fields
    // normalize depends on most.
    const ctx = contextWith(httpReturning({ [URL_FOR('acme')]: fixture }), { boards: ['acme'] })
    const [first] = await collect(greenhouseAdapter.fetch(ctx))
    const payload = (first as any).payload

    for (const key of ['company_name', 'first_published', 'language', 'departments', 'offices']) {
      expect(payload, `payload lost "${key}"`).toHaveProperty(key)
    }
  })

  it('carries on when one board fails, rather than abandoning the crawl', async () => {
    const ctx = contextWith(
      httpReturning({
        [URL_FOR('dead')]: new Error('HTTP 404'),
        [URL_FOR('alive')]: fixture,
      }),
      { boards: ['dead', 'alive'] },
    )
    const postings = await collect(greenhouseAdapter.fetch(ctx))

    expect(postings).toHaveLength(fixture.jobs.length)
    expect(ctx.logs.some(([m]: any) => m === 'board fetch failed')).toBe(true)
    // Logging is not enough: the caller has to be able to judge the run.
    expect(ctx.failures).toEqual([['board:dead', expect.stringContaining('404')]])
  })

  it('skips a board whose response does not match the expected shape', async () => {
    const ctx = contextWith(
      httpReturning({ [URL_FOR('weird')]: { unexpected: true }, [URL_FOR('alive')]: fixture }),
      { boards: ['weird', 'alive'] },
    )
    const postings = await collect(greenhouseAdapter.fetch(ctx))

    expect(postings).toHaveLength(fixture.jobs.length)
    expect(ctx.failures).toHaveLength(1)
  })

  it('rejects a config it cannot use, instead of fetching nothing quietly', async () => {
    const ctx = contextWith(httpReturning({}), { boards: [] })
    await expect(collect(greenhouseAdapter.fetch(ctx))).rejects.toBeInstanceOf(SourceConfigError)
  })
})

describe('content hash', () => {
  const job = fixture.jobs[0]! as any

  it('is stable for an identical job', () => {
    expect(greenhouseContentHash(job)).toBe(greenhouseContentHash({ ...job }))
  })

  it('changes when the text changes', () => {
    expect(greenhouseContentHash({ ...job, title: `${job.title} (Remote)` })).not.toBe(
      greenhouseContentHash(job),
    )
  })

  it('ignores updated_at, so a touched-but-unchanged posting is not reprocessed', () => {
    // Greenhouse bumps updated_at on edits that do not touch the text. Letting
    // that through would re-classify and re-embed for nothing.
    expect(greenhouseContentHash({ ...job, updated_at: '2099-01-01T00:00:00-00:00' })).toBe(
      greenhouseContentHash(job),
    )
  })
})

describe('base url configuration', () => {
  it('defaults to the public Greenhouse API', async () => {
    const http = httpReturning({
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true': fixture,
    })
    const ctx = contextWith(http, { boards: ['acme'] })

    // Resolving means the default was applied; an unexpected URL throws.
    await expect(collect(greenhouseAdapter.fetch(ctx))).resolves.toHaveLength(fixture.jobs.length)
  })

  it('uses a baseUrl from the source config, so a mock can be pointed at', async () => {
    const http = httpReturning({
      'https://mock.test/v1/boards/acme/jobs?content=true': fixture,
    })
    const ctx = contextWith(http, { boards: ['acme'], baseUrl: 'https://mock.test/v1' })

    await expect(collect(greenhouseAdapter.fetch(ctx))).resolves.toHaveLength(fixture.jobs.length)
  })

  it('tolerates a trailing slash on the configured baseUrl', async () => {
    const http = httpReturning({
      'https://mock.test/v1/boards/acme/jobs?content=true': fixture,
    })
    const ctx = contextWith(http, { boards: ['acme'], baseUrl: 'https://mock.test/v1/' })

    await expect(collect(greenhouseAdapter.fetch(ctx))).resolves.toHaveLength(fixture.jobs.length)
  })

  it('rejects a baseUrl that is not a URL, rather than building a broken request', async () => {
    const ctx = contextWith(httpReturning({}), { boards: ['acme'], baseUrl: 'not-a-url' })
    await expect(collect(greenhouseAdapter.fetch(ctx))).rejects.toBeInstanceOf(SourceConfigError)
  })
})
