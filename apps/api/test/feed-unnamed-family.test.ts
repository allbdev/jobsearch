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
let client = 0

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-forwarded-for': `198.21.0.${(client++ % 250) + 1}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

/** A live, confirmed, worldwide job — so only its family decides anything. */
async function seedJob(index: number, jobFamily: string | null) {
  return prisma.job.create({
    data: {
      companyId,
      title: `Unnamed family job ${index}`,
      description: '',
      applyUrl: `https://example.test/${run}/${index}`,
      jobFamily,
      postedAt: new Date(),
      contentHash: `unnamed-${run}-${index}`,
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

async function statsOf(feedId: string) {
  const { body } = await call('GET', `/feeds/${feedId}`)
  return body.stats as { withoutFamily: number }
}

async function createFeed(name: string, jobFamilies: string[]) {
  const { body } = await call('POST', '/feeds', {
    name, jobFamilies, eligibleFrom: [], contractModels: [],
    minCompensation: null, currency: 'USD', freshnessDays: null, hideRejected: true,
  })
  return body.id as string
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('jobs a family filter hides', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`

    companyId = (await prisma.company.create({ data: { name: `unnamed-${run}` } })).id
    token = (
      await call('POST', '/auth/register', { email: `unnamed-${run}@example.test`, password: 'correct horse battery' })
    ).body.token
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: `unnamed-${run}@example.test` } })
    await prisma.job.deleteMany({ where: { companyId } })
    await prisma.company.delete({ where: { id: companyId } })
  })

  // Measured as a delta rather than an absolute: a developer's database has a
  // real crawl in it, and the count is over the whole index by design.
  it('counts a job the filter hides, and not one it was going to show anyway', async () => {
    const feedId = await createFeed('Frontend only', ['engineering-frontend'])
    const before = (await statsOf(feedId)).withoutFamily

    await seedJob(1, null)
    await seedJob(2, null)
    expect((await statsOf(feedId)).withoutFamily).toBe(before + 2)

    // Named, and named as what the feed asked for: it is in the list, so it is
    // not something the filter is hiding.
    await seedJob(3, 'engineering-frontend')
    expect((await statsOf(feedId)).withoutFamily).toBe(before + 2)
  })

  it('counts a job named as a family this feed did not ask for as hidden by nothing', async () => {
    // The reader excluded it on purpose. Only the postings nobody has named
    // are a surprise worth reporting.
    const feedId = await createFeed('Frontend again', ['engineering-frontend'])
    const before = (await statsOf(feedId)).withoutFamily
    await seedJob(4, 'engineering-backend')
    expect((await statsOf(feedId)).withoutFamily).toBe(before)
  })

  it('reports nothing for a feed that filters by no family', async () => {
    // Nothing is being hidden, so there is nothing to explain.
    const feedId = await createFeed('Everything', [])
    await seedJob(5, null)
    expect((await statsOf(feedId)).withoutFamily).toBe(0)
  })

  it('stops counting one the reader dismissed', async () => {
    const feedId = await createFeed('Frontend, third', ['engineering-frontend'])
    const job = await seedJob(6, null)
    const before = (await statsOf(feedId)).withoutFamily

    await call('PUT', `/jobs/${job.id}/interaction`, { status: 'dismissed' })
    expect((await statsOf(feedId)).withoutFamily).toBe(before - 1)
  })
})
