import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/configure-app'
import { MAX_FEEDS_PER_USER } from '../src/feeds/feeds.service'

const run = randomUUID().slice(0, 8)
let app: NestExpressApplication
let base: string
let owner: string
let stranger: string

const definition = {
  name: 'Design in LATAM',
  jobFamilies: ['design-product'],
  eligibleFrom: ['LATAM', 'BR', 'LATAM'],
  contractModels: ['contractor_pj', 'eor'],
  minCompensation: 90_000,
  currency: 'USD',
  freshnessDays: null,
  hideRejected: true,
}

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      // A distinct client per test file run, clear of the auth rate limits.
      'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function signUp(label: string): Promise<string> {
  const { body } = await call('POST', '/auth/register', null, {
    email: `feeds-write-${run}-${label}@example.test`,
    password: 'correct horse battery',
  })
  return body.token
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('creating, replacing and deleting feeds', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    owner = await signUp('owner')
    stranger = await signUp('stranger')
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `feeds-write-${run}-` } } })
  })

  it('creates a feed, stores money in minor units, and answers with its match count', async () => {
    const created = await call('POST', '/feeds', owner, definition)
    expect(created.status).toBe(201)
    expect(created.body.definition).toMatchObject({ name: 'Design in LATAM', eligibleFrom: ['LATAM', 'BR'], minCompensation: 90_000 })
    expect(typeof created.body.matchedCount).toBe('number')

    const row = await prisma.feed.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(row.minCompensation).toBe(9_000_000)

    const listed = await call('GET', '/feeds', owner)
    expect(listed.body.map((feed: { id: string }) => feed.id)).toContain(created.body.id)
  })

  it('refuses what would save a feed that silently matches nothing', async () => {
    const bad = await call('POST', '/feeds', owner, {
      ...definition,
      name: '  ',
      eligibleFrom: ['Brazil listed'],
      jobFamilies: ['engineering-quantum'],
      currency: 'usd',
    })
    expect(bad.status).toBe(400)
    const paths = bad.body.issues.map((issue: { path: string }) => issue.path).sort()
    expect(paths).toEqual(['currency', 'eligibleFrom.0', 'jobFamilies', 'name'])
  })

  it('replaces a feed for its owner and is a 404 for anyone else', async () => {
    const { body: feed } = await call('POST', '/feeds', owner, definition)
    const renamed = { ...definition, name: 'Renamed', eligibleFrom: ['Worldwide'], minCompensation: null }

    expect((await call('PUT', `/feeds/${feed.id}`, stranger, renamed)).status).toBe(404)
    const replaced = await call('PUT', `/feeds/${feed.id}`, owner, renamed)
    expect(replaced.status).toBe(200)
    expect(replaced.body.definition).toMatchObject({ name: 'Renamed', eligibleFrom: ['Worldwide'], minCompensation: null })
  })

  it('deletes only for the owner', async () => {
    const { body: feed } = await call('POST', '/feeds', owner, definition)
    expect((await call('DELETE', `/feeds/${feed.id}`, stranger)).status).toBe(404)
    expect((await call('DELETE', `/feeds/${feed.id}`, owner)).status).toBe(204)
    expect((await call('GET', `/feeds/${feed.id}`, owner)).status).toBe(404)
  })

  it('requires a session for every write', async () => {
    expect((await call('POST', '/feeds', null, definition)).status).toBe(401)
    expect((await call('PUT', '/feeds/any', null, definition)).status).toBe(401)
    expect((await call('DELETE', '/feeds/any', null)).status).toBe(401)
  })

  it(`stops at ${MAX_FEEDS_PER_USER} feeds`, async () => {
    const token = await signUp('many')
    for (let index = 0; index < MAX_FEEDS_PER_USER; index++) {
      expect((await call('POST', '/feeds', token, { ...definition, name: `Feed ${index}` })).status).toBe(201)
    }
    const over = await call('POST', '/feeds', token, definition)
    expect(over.status).toBe(409)
    expect(over.body.reason).toBe('feed_limit')
  })
})
