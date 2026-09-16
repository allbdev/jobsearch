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

const profile = {
  residenceCountry: 'BR',
  timezone: 'America/Sao_Paulo',
  targetRegions: ['LATAM', 'US', 'LATAM'],
  languages: ['pt-BR', 'en'],
  jobFamilies: ['engineering-frontend'],
  targetRoles: 'Frontend Engineer',
  seniority: 'senior',
  skills: ['React', 'TypeScript', 'React'],
  contractModels: ['contractor_pj'],
  minCompensation: 90_000,
  currency: 'USD',
  interfaceLanguage: 'pt-br',
  digest: { cadence: 'weekly', sendOn: 'monday', sendAt: '08:00', language: 'pt-br' },
}

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

const signUp = async (label: string) =>
  (await call('POST', '/auth/register', null, { email: `profile-${run}-${label}@example.test`, password: 'correct horse battery' }))
    .body.token as string

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('profile', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `profile-${run}-` } } })
  })

  it('answers a new account with a 404 that says there is no profile yet', async () => {
    const token = await signUp('new')
    expect(await call('GET', '/profile', token)).toMatchObject({ status: 404, body: { reason: 'no_profile' } })
  })

  it('creates, reads back and replaces a profile, with the account email and minor-unit money', async () => {
    const token = await signUp('saved')
    const saved = await call('PUT', '/profile', token, profile)
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({
      residenceCountry: 'BR',
      targetRegions: ['LATAM', 'US'],
      skills: ['React', 'TypeScript'],
      minCompensation: 90_000,
      email: `profile-${run}-saved@example.test`,
      digest: { cadence: 'weekly', sendOn: 'monday', sendAt: '08:00', language: 'pt-br' },
    })
    expect((await call('GET', '/profile', token)).body).toEqual(saved.body)

    const row = await prisma.profile.findFirstOrThrow({ where: { user: { email: `profile-${run}-saved@example.test` } } })
    expect(row.minCompensation).toBe(9_000_000)

    const replaced = await call('PUT', '/profile', token, { ...profile, residenceCountry: 'PT', minCompensation: null })
    expect(replaced.body).toMatchObject({ residenceCountry: 'PT', minCompensation: null })
  })

  it('refuses display strings where codes are stored', async () => {
    const token = await signUp('labels')
    const bad = await call('PUT', '/profile', token, {
      ...profile,
      residenceCountry: 'Brazil',
      timezone: 'UTC−3 · Brasília',
      targetRegions: ['Europe'],
      languages: ['Português'],
      interfaceLanguage: 'English',
      digest: { ...profile.digest, sendOn: 'Monday', sendAt: '25:00' },
    })
    expect(bad.status).toBe(400)
    expect(bad.body.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([
      'digest.sendAt',
      'digest.sendOn',
      'interfaceLanguage',
      'languages.0',
      'residenceCountry',
      'targetRegions.0',
      'timezone',
    ])
  })

  it('makes residence decide what a feed matches', async () => {
    const token = await signUp('matching')
    const feed = await call('POST', '/feeds', token, {
      name: 'Everything', jobFamilies: [], eligibleFrom: [], contractModels: [],
      minCompensation: null, currency: 'USD', freshnessDays: null, hideRejected: true,
    })
    const before = feed.body.matchedCount as number

    await call('PUT', '/profile', token, profile)
    const after = (await call('GET', '/feeds', token)).body[0].matchedCount as number

    // No residence blocks nothing; living in Brazil hides confirmed jobs closed to Brazil.
    expect(after).toBeLessThan(before)
  })

  it('requires a session', async () => {
    expect((await call('GET', '/profile', null)).status).toBe(401)
    expect((await call('PUT', '/profile', null, profile)).status).toBe(401)
  })
})
