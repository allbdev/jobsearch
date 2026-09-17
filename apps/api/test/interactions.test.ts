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
let client = 0
const jobs: Record<'first' | 'second', string> = { first: '', second: '' }

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-forwarded-for': `198.19.0.${(client++ % 250) + 1}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function signUpWithFeed(label: string) {
  const token = (await call('POST', '/auth/register', null, { email: `interactions-${run}-${label}@example.test`, password: 'correct horse battery' })).body.token as string
  // Matches the two seeded jobs, and whatever else the database holds.
  const feed = await call('POST', '/feeds', token, {
    name: 'Everything', jobFamilies: [], eligibleFrom: [], contractModels: [],
    minCompensation: null, currency: 'USD', freshnessDays: null, hideRejected: true,
  })
  return { token, feedId: feed.body.id as string }
}

/** The feed page as the web asks for it, reduced to what these tests look at. */
async function feedPage(token: string, feedId: string) {
  const { body } = await call('GET', `/feeds/${feedId}?limit=200&sort=newest`, token)
  const listed = await call('GET', '/feeds', token)
  return {
    ids: (body.jobs as { id: string; interaction?: string | null }[]).map((job) => job.id),
    interactionOf: (id: string) => (body.jobs as { id: string; interaction?: string | null }[]).find((job) => job.id === id)?.interaction,
    matched: body.feed.matchedCount as number,
    listedCount: listed.body[0].matchedCount as number,
    dismissed: body.stats.dismissedByUser as number,
  }
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('job interactions', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`

    // Seeded, never borrowed from a crawl: CI's database is empty. Posted in the
    // future so `sort=newest` puts them on the first page even beside a real crawl.
    companyId = (await prisma.company.create({ data: { name: `interactions-${run}` } })).id
    for (const [index, key] of (['first', 'second'] as const).entries()) {
      jobs[key] = (
        await prisma.job.create({
          data: {
            companyId,
            title: `Interaction test ${key}`,
            description: '',
            applyUrl: `https://example.test/${run}/${key}`,
            postedAt: new Date(Date.now() + 86_400_000 + index),
            contentHash: `interactions-${run}-${key}`,
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
      ).id
    }
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `interactions-${run}-` } } })
    await prisma.job.deleteMany({ where: { companyId } })
    await prisma.company.delete({ where: { id: companyId } })
  })

  it('saves, then moves the same job to applied, and the history shows it once', async () => {
    const { token, feedId } = await signUpWithFeed('history')
    expect(await call('PUT', `/jobs/${jobs.first}/interaction`, token, { status: 'saved' })).toMatchObject({ status: 200, body: { status: 'saved' } })
    expect((await feedPage(token, feedId)).interactionOf(jobs.first)).toBe('saved')

    await call('PUT', `/jobs/${jobs.first}/interaction`, token, { status: 'applied' })
    const history = (await call('GET', '/profile/history', token)).body
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ jobId: jobs.first, title: 'Interaction test first', status: 'applied', confirmed: true, regionLabel: 'Worldwide' })
    expect(new Date(history[0].date).toString()).not.toBe('Invalid Date')
  })

  it('takes a dismissed job out of the feed and its counts, and puts it back when cleared', async () => {
    const { token, feedId } = await signUpWithFeed('dismiss')
    const before = await feedPage(token, feedId)
    expect(before.ids).toContain(jobs.second)
    expect(before.dismissed).toBe(0)

    await call('PUT', `/jobs/${jobs.second}/interaction`, token, { status: 'dismissed' })
    const hidden = await feedPage(token, feedId)
    expect(hidden.ids).not.toContain(jobs.second)
    expect(hidden.matched).toBe(before.matched - 1)
    expect(hidden.listedCount).toBe(before.listedCount - 1)
    expect(hidden.dismissed).toBe(1)

    expect((await call('DELETE', `/jobs/${jobs.second}/interaction`, token)).status).toBe(204)
    const restored = await feedPage(token, feedId)
    expect(restored.ids).toContain(jobs.second)
    expect(restored.dismissed).toBe(0)
  })

  it('keeps one reader’s dismissals out of everyone else’s feed', async () => {
    const mine = await signUpWithFeed('mine')
    const theirs = await signUpWithFeed('theirs')
    await call('PUT', `/jobs/${jobs.second}/interaction`, mine.token, { status: 'dismissed' })
    const other = await feedPage(theirs.token, theirs.feedId)
    expect(other.ids).toContain(jobs.second)
    expect(other.dismissed).toBe(0)
    expect(other.interactionOf(jobs.second)).toBeNull()
  })

  it('refuses an unknown job, an unknown status, and anyone not signed in', async () => {
    const { token } = await signUpWithFeed('refusals')
    expect((await call('PUT', '/jobs/no-such-job/interaction', token, { status: 'saved' })).status).toBe(404)
    expect((await call('PUT', `/jobs/${jobs.first}/interaction`, token, { status: 'loved' })).status).toBe(400)
    expect((await call('PUT', `/jobs/${jobs.first}/interaction`, null, { status: 'saved' })).status).toBe(401)
    expect((await call('GET', '/profile/history', null)).status).toBe(401)
    // Clearing what was never set is not an error.
    expect((await call('DELETE', `/jobs/${jobs.first}/interaction`, token)).status).toBe(204)
  })
})
