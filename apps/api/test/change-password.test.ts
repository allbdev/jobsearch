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
const OLD = 'correct horse battery'
const NEW = 'a different long password'
let app: NestExpressApplication
let base: string
let client = 0

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      // A fresh client per request, except where a test pins one to exercise the limit.
      'x-forwarded-for': `198.18.0.${(client++ % 250) + 1}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

const email = (label: string) => `change-password-${run}-${label}@example.test`
const register = async (label: string) =>
  (await call('POST', '/auth/register', null, { email: email(label), password: OLD })).body.token as string
const login = async (label: string, password: string) =>
  (await call('POST', '/auth/login', null, { email: email(label), password })).status

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('changing a password', () => {
  beforeAll(async () => {
    delete process.env.RESEND_API_KEY
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
    configureApp(app)
    await app.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app.close()
    await prisma.user.deleteMany({ where: { email: { startsWith: `change-password-${run}-` } } })
  })

  it('replaces the password and signs out every other session, but not this one', async () => {
    const here = await register('happy')
    const elsewhere = (await call('POST', '/auth/login', null, { email: email('happy'), password: OLD })).body.token

    expect((await call('POST', '/auth/password/change', here, { currentPassword: OLD, newPassword: NEW })).status).toBe(204)

    expect((await call('GET', '/auth/me', here)).status).toBe(200)
    expect((await call('GET', '/auth/me', elsewhere)).status).toBe(401)
    expect(await login('happy', OLD)).toBe(401)
    expect(await login('happy', NEW)).toBe(200)
  })

  it('refuses a wrong current password and changes nothing', async () => {
    const token = await register('wrong')
    const refused = await call('POST', '/auth/password/change', token, { currentPassword: 'not it at all', newPassword: NEW })
    expect(refused).toMatchObject({ status: 400, body: { reason: 'wrong_password' } })
    expect(await login('wrong', OLD)).toBe(200)
  })

  it('sends an account with no password to the emailed reset instead', async () => {
    const user = await prisma.user.create({ data: { email: email('oauth-only'), emailVerifiedAt: new Date() } })
    const { token } = await new SessionsService(prisma).create(user.id)
    const refused = await call('POST', '/auth/password/change', token, { currentPassword: 'anything', newPassword: NEW })
    expect(refused).toMatchObject({ status: 400, body: { reason: 'no_password' } })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toBeNull()
  })

  it('holds the new password to the registration rule, and requires a session', async () => {
    const token = await register('rules')
    const short = await call('POST', '/auth/password/change', token, { currentPassword: OLD, newPassword: 'short' })
    expect(short.status).toBe(400)
    expect(short.body.issues.map((issue: { path: string }) => issue.path)).toEqual(['newPassword'])
    expect((await call('POST', '/auth/password/change', null, { currentPassword: OLD, newPassword: NEW })).status).toBe(401)
  })

  it('limits guesses from one client', async () => {
    const token = await register('guessing')
    const statuses: number[] = []
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await fetch(`${base}/auth/password/change`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-forwarded-for': '198.18.1.1' },
        body: JSON.stringify({ currentPassword: `guess ${attempt}`, newPassword: NEW }),
      })
      statuses.push(response.status)
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
  })
})
