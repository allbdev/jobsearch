import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/configure-app'

const run = randomUUID().slice(0, 8)
let app: NestExpressApplication
let base: string
let companyId: string
let token: string
let feedId: string
let client = 0

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-forwarded-for': `198.20.0.${(client++ % 250) + 1}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

/** Ids of one page, so a shifted window is visible even where titles repeat. */
async function page(query: string): Promise<string[]> {
  const { body } = await call('GET', `/feeds/${feedId}?${query}`)
  return (body.jobs as { id: string }[]).map((job) => job.id)
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('paging a feed', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`

    // Five jobs of its own, posted in the future so `newest` puts them first
    // even beside a real crawl, and with one shared title -- the duplicate
    // titles in the real index are what made an id check necessary.
    companyId = (await prisma.company.create({ data: { name: `paging-${run}` } })).id
    for (let index = 0; index < 5; index++) {
      await prisma.job.create({
        data: {
          companyId,
          title: index < 2 ? 'Shared title' : `Paged job ${index}`,
          description: '',
          applyUrl: `https://example.test/${run}/${index}`,
          postedAt: new Date(Date.now() + 86_400_000 * (5 - index)),
          contentHash: `paging-${run}-${index}`,
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
    }

    token = (await call('POST', '/auth/register', { email: `paging-${run}@example.test`, password: 'correct horse battery' })).body.token
    feedId = (
      await call('POST', '/feeds', {
        name: 'Everything', jobFamilies: [], eligibleFrom: [], contractModels: [],
        minCompensation: null, currency: 'USD', freshnessDays: null, hideRejected: true,
      })
    ).body.id
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: `paging-${run}@example.test` } })
    await prisma.job.deleteMany({ where: { companyId } })
    await prisma.company.delete({ where: { id: companyId } })
  })

  it('returns the window after the offset, with no gap and no repeat', async () => {
    const [first, second] = [await page('sort=newest&limit=2&offset=0'), await page('sort=newest&limit=2&offset=2')]
    expect(first).toHaveLength(2)
    expect(second).toHaveLength(2)
    expect(new Set([...first, ...second]).size).toBe(4)

    const four = await page('sort=newest&limit=4&offset=0')
    expect(four).toEqual([...first, ...second])
  })

  it('shifts by exactly one for offset=1, even where two jobs share a title', async () => {
    const from0 = await page('sort=newest&limit=3&offset=0')
    const from1 = await page('sort=newest&limit=3&offset=1')
    expect(from1.slice(0, 2)).toEqual(from0.slice(1))
  })

  it('runs past the end without complaining', async () => {
    const { status, body } = await call('GET', `/feeds/${feedId}?offset=4999&limit=5`)
    expect(status).toBe(200)
    expect(body.jobs).toEqual([])
    // The count is the feed's, not the page's.
    expect(body.feed.matchedCount).toBeGreaterThanOrEqual(5)
  })

  it('refuses an offset that is not a whole number in range', async () => {
    for (const offset of ['-1', 'abc', '5001', '1.5']) {
      expect((await call('GET', `/feeds/${feedId}?offset=${offset}`)).status).toBe(400)
    }
  })
})
