import { randomUUID } from 'node:crypto'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { loginRequestSchema, registerRequestSchema } from '@jobsearch/shared'
import { AuthService } from '../src/auth/auth.service'
import { SESSION_TTL_MS, SessionsService, hashToken } from '../src/auth/sessions.service'

// Against a real Postgres, like feed-query.test.ts, and scoped to addresses
// minted here.
const run = randomUUID().slice(0, 8)
const email = (label: string) => `auth-test-${run}-${label}@example.test`
const DAY = 86_400_000

const sessions = new SessionsService(prisma)
const auth = new AuthService(prisma, sessions)
const register = (label: string, password = 'correct horse battery') =>
  auth.register(registerRequestSchema.parse({ email: email(label), password }))
const login = (address: string, password: string) =>
  auth.login(loginRequestSchema.parse({ email: address, password }))

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('password auth', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `auth-test-${run}-` } } })
    await prisma.$disconnect()
  })

  it('registers, stores argon2id rather than the password, and signs in', async () => {
    const registered = await register('happy')
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: registered.user.id } })
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
    expect(registered.user).toMatchObject({ email: email('happy'), emailVerified: false })

    const signedIn = await login(email('happy').toUpperCase(), 'correct horse battery')
    expect(signedIn.user.id).toBe(registered.user.id)
  })

  it('refuses a second account on the same address, whatever its case', async () => {
    await register('taken')
    await expect(
      auth.register(registerRequestSchema.parse({ email: ` ${email('taken').toUpperCase()} `, password: 'another long one' })),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('gives a wrong password and an unknown address the same answer', async () => {
    await register('wrong')
    const wrong = await login(email('wrong'), 'not the password').catch((error: unknown) => error)
    const unknown = await login(email('nobody'), 'not the password').catch((error: unknown) => error)
    expect(wrong).toBeInstanceOf(UnauthorizedException)
    expect(unknown).toBeInstanceOf(UnauthorizedException)
    expect((wrong as Error).message).toBe((unknown as Error).message)
  })

  it('treats an account with no password like one that does not exist', async () => {
    await prisma.user.create({ data: { email: email('oauth-only') } })
    await expect(login(email('oauth-only'), 'anything at all')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('stores only the hash of a session token', async () => {
    const { token } = await register('hashed')
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull()
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).not.toBeNull()
  })

  it('validates, extends in the second half of its life, expires and revokes', async () => {
    const { user } = await register('lifecycle')
    const start = new Date()
    const { token } = await sessions.create(user.id, start)

    expect((await sessions.validate(token, start))?.id).toBe(user.id)
    const untouched = await prisma.session.findUniqueOrThrow({ where: { id: hashToken(token) } })
    expect(untouched.expiresAt.getTime()).toBe(start.getTime() + SESSION_TTL_MS)

    const later = new Date(start.getTime() + 20 * DAY)
    await sessions.validate(token, later)
    const renewed = await prisma.session.findUniqueOrThrow({ where: { id: hashToken(token) } })
    expect(renewed.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS)

    expect(await sessions.validate(token, new Date(later.getTime() + SESSION_TTL_MS))).toBeNull()
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).toBeNull()

    const second = await sessions.create(user.id)
    await sessions.revoke(second.token)
    expect(await sessions.validate(second.token)).toBeNull()
  })
})
