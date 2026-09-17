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
let client = 0

async function unsubscribe(token: unknown, from = `198.22.0.${(client++ % 250) + 1}`) {
  const response = await fetch(`${base}/digest/unsubscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': from },
    body: JSON.stringify({ token }),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function subscriber(label: string, cadence: 'daily' | 'weekly' = 'weekly') {
  const user = await prisma.user.create({ data: { email: `unsub-${run}-${label}@example.test` } })
  return prisma.profile.create({
    data: { userId: user.id, residenceCountry: 'BR', timezone: 'America/Sao_Paulo', digestCadence: cadence },
  })
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('unsubscribing from the digest', () => {
  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `unsub-${run}-` } } })
  })

  it('turns the digest off with no session at all', async () => {
    const profile = await subscriber('happy')
    expect((await unsubscribe(profile.unsubscribeToken)).status).toBe(204)
    expect((await prisma.profile.findUniqueOrThrow({ where: { id: profile.id } })).digestCadence).toBe('off')
  })

  it('is idempotent: clicking the link twice is not an error', async () => {
    const profile = await subscriber('twice', 'daily')
    expect((await unsubscribe(profile.unsubscribeToken)).status).toBe(204)
    expect((await unsubscribe(profile.unsubscribeToken)).status).toBe(204)
    expect((await prisma.profile.findUniqueOrThrow({ where: { id: profile.id } })).digestCadence).toBe('off')
  })

  it('touches nobody else', async () => {
    const [mine, theirs] = [await subscriber('mine'), await subscriber('theirs')]
    await unsubscribe(mine.unsubscribeToken)
    expect((await prisma.profile.findUniqueOrThrow({ where: { id: theirs.id } })).digestCadence).toBe('weekly')
  })

  it('says so when the link is not recognised, and refuses an empty one', async () => {
    expect(await unsubscribe('not-a-real-token')).toMatchObject({ status: 404, body: { reason: 'unknown_token' } })
    expect((await unsubscribe('')).status).toBe(400)
    expect((await unsubscribe(undefined)).status).toBe(400)
  })

  it('caps how often one client may try', async () => {
    const statuses: number[] = []
    for (let attempt = 0; attempt < 21; attempt++) statuses.push((await unsubscribe('not-a-real-token', '198.22.9.9')).status)
    expect(statuses.slice(0, 20).every((status) => status === 404)).toBe(true)
    expect(statuses[20]).toBe(429)
  })
})
