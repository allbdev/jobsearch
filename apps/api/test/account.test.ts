import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { AppModule } from '../src/app.module'
import { SessionsService } from '../src/auth/sessions.service'
import { configureApp } from '../src/configure-app'

const run = randomUUID().slice(0, 8)
const PASSWORD = 'correct horse battery'
let app: NestExpressApplication
let base: string
let client = 0

const email = (label: string) => `account-${run}-${label}@example.test`

async function call(method: string, path: string, token: string | null, body?: unknown) {
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

const register = async (label: string) =>
  (await call('POST', '/auth/register', null, { email: email(label), password: PASSWORD })).body.token as string

/** An account that has only ever signed in with a provider: no password. */
async function oauthOnly(label: string, providers: ('google' | 'github')[]) {
  const user = await prisma.user.create({
    data: {
      email: email(label),
      emailVerifiedAt: new Date(),
      oauthAccounts: { create: providers.map((provider) => ({ provider, providerUserId: `${run}-${label}-${provider}` })) },
    },
  })
  const { token } = await new SessionsService(prisma).create(user.id)
  return { user, token }
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('account', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `account-${run}-` } } })
  })

  it('reports how this person can sign in', async () => {
    const token = await register('summary')
    expect((await call('GET', '/account', token)).body).toMatchObject({
      email: email('summary'),
      hasPassword: true,
      connections: [],
    })

    const linked = await oauthOnly('linked', ['google', 'github'])
    const { body } = await call('GET', '/account', linked.token)
    expect(body).toMatchObject({ hasPassword: false, emailVerified: true })
    expect(body.connections.map((c: { provider: string }) => c.provider)).toEqual(['google', 'github'])
    expect(new Date(body.connections[0].linkedAt).toString()).not.toBe('Invalid Date')
  })

  it('unlinks a provider while another way in remains', async () => {
    const both = await oauthOnly('two-providers', ['google', 'github'])
    expect((await call('DELETE', '/account/connections/google', both.token)).status).toBe(204)
    expect((await call('GET', '/account', both.token)).body.connections).toHaveLength(1)
  })

  it('refuses to unlink the only way in', async () => {
    const only = await oauthOnly('one-provider', ['google'])
    const refused = await call('DELETE', '/account/connections/google', only.token)
    expect(refused).toMatchObject({ status: 400, body: { reason: 'last_way_in' } })
    expect((await call('GET', '/account', only.token)).body.connections).toHaveLength(1)

    // With a password set, the same unlink is fine: the password is the way in.
    await prisma.user.update({ where: { id: only.user.id }, data: { passwordHash: '$argon2id$stub' } })
    expect((await call('DELETE', '/account/connections/google', only.token)).status).toBe(204)
  })

  it('refuses an unknown or unlinked provider', async () => {
    const token = await register('unlink-refusals')
    expect((await call('DELETE', '/account/connections/twitter', token)).status).toBe(400)
    expect(await call('DELETE', '/account/connections/github', token)).toMatchObject({
      status: 400,
      body: { reason: 'not_linked' },
    })
  })

  it('deletes the account and everything hanging off it', async () => {
    const token = await register('goodbye')
    const user = await prisma.user.findUniqueOrThrow({ where: { email: email('goodbye') } })
    await prisma.profile.create({ data: { userId: user.id, residenceCountry: 'BR', timezone: 'America/Sao_Paulo' } })
    const feed = await prisma.feed.create({ data: { userId: user.id, name: 'Everything' } })
    const job = await prisma.job.findFirst({ select: { id: true } })
    if (job) await prisma.jobInteraction.create({ data: { userId: user.id, jobId: job.id, status: 'saved' } })

    expect((await call('DELETE', '/account', token, { password: PASSWORD })).status).toBe(204)

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
    expect(await prisma.profile.findUnique({ where: { userId: user.id } })).toBeNull()
    expect(await prisma.feed.findUnique({ where: { id: feed.id } })).toBeNull()
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.jobInteraction.count({ where: { userId: user.id } })).toBe(0)
    // The job itself is not this person's data.
    if (job) expect(await prisma.job.findUnique({ where: { id: job.id } })).not.toBeNull()
    // The session is gone with it.
    expect((await call('GET', '/account', token)).status).toBe(401)
  })

  it('will not delete on a wrong password, and asks a password-less account to type the word', async () => {
    const token = await register('kept')
    expect(await call('DELETE', '/account', token, { password: 'not my password' })).toMatchObject({
      status: 400,
      body: { reason: 'wrong_password' },
    })
    expect((await call('GET', '/account', token)).status).toBe(200)

    const provider = await oauthOnly('typed', ['google'])
    expect(await call('DELETE', '/account', provider.token, {})).toMatchObject({
      status: 400,
      body: { reason: 'confirmation_required' },
    })
    expect((await call('DELETE', '/account', provider.token, { confirm: 'delete' })).status).toBe(400)
    expect((await call('DELETE', '/account', provider.token, { confirm: 'DELETE' })).status).toBe(204)
  })

  it('requires a session', async () => {
    expect((await call('GET', '/account', null)).status).toBe(401)
    expect((await call('DELETE', '/account', null, { password: PASSWORD })).status).toBe(401)
    expect((await call('DELETE', '/account/connections/google', null)).status).toBe(401)
  })
})
