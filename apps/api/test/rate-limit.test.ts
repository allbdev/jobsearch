import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/configure-app'

/**
 * Over real HTTP against the real app: throttling is guards, decorators and
 * proxy trust working together, and none of that exists below the HTTP layer.
 */
const run = randomUUID().slice(0, 8)
let app: NestExpressApplication
let base: string

/** A request as the web would forward it, from browser `client`. */
function post(path: string, body: unknown, client: string) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': client },
    body: JSON.stringify(body),
  }).then((response) => response.status)
}

async function statuses(count: number, send: (index: number) => Promise<number>) {
  const results: number[] = []
  for (let index = 0; index < count; index++) results.push(await send(index))
  return results
}

// A distinct address per test, so the in-memory buckets never overlap.
let nextIp = 1
const ip = () => `203.0.113.${nextIp++}`

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('auth rate limits', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `limit-test-${run}-` } } })
  })

  it('limits one client, and counts each forwarded client separately', async () => {
    const [a, b] = [ip(), ip()]
    // A different address each time, so only the per-client limit is in play.
    const invalid = (index: number) => ({ email: `limit-test-${run}-reg-${index}@example.test`, password: 'x' })
    const fromA = await statuses(11, (index) => post('/auth/register', invalid(index), a))
    expect(fromA.slice(0, 10)).toEqual(Array(10).fill(400))
    expect(fromA[10]).toBe(429)
    // A different browser behind the same web server is unaffected.
    expect(await post('/auth/register', invalid(99), b)).toBe(400)
  })

  it('caps reset emails to one inbox however many clients ask', async () => {
    const target = { email: `limit-test-${run}-inbox@example.test` }
    const results = await statuses(4, () => post('/auth/password/forgot', target, ip()))
    expect(results).toEqual([204, 204, 204, 429])
  })

  it('treats one address in different spellings as one inbox', async () => {
    const address = `limit-test-${run}-case@example.test`
    const spellings = [address, address.toUpperCase(), ` ${address} `, address]
    const results = await statuses(4, (index) => post('/auth/password/forgot', { email: spellings[index] }, ip()))
    expect(results.at(-1)).toBe(429)
  })

  it('limits sign-in attempts against one account across rotating clients', async () => {
    const attempt = { email: `limit-test-${run}-stuffed@example.test`, password: 'guess guess guess' }
    const results = await statuses(11, () => post('/auth/login', attempt, ip()))
    expect(results.slice(0, 10)).toEqual(Array(10).fill(401))
    expect(results[10]).toBe(429)
  })

  it('leaves routes outside auth unthrottled', async () => {
    const client = ip()
    const results = await statuses(40, () =>
      fetch(`${base}/health`, { headers: { 'x-forwarded-for': client } }).then((r) => r.status),
    )
    expect(results.every((status) => status === 200)).toBe(true)
  })
})
