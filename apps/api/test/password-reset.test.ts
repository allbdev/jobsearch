import { randomUUID } from 'node:crypto'
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { loginRequestSchema, registerRequestSchema, resetPasswordRequestSchema } from '@jobsearch/shared'
import { AUTH_TOKEN_TTL_MS, AuthTokensService } from '../src/auth/auth-tokens.service'
import { AuthService } from '../src/auth/auth.service'
import { SessionsService } from '../src/auth/sessions.service'
import type { Email } from '../src/email/mailer'
import { Mailer } from '../src/email/mailer'

const run = randomUUID().slice(0, 8)
const email = (label: string) => `reset-test-${run}-${label}@example.test`
const OLD = 'correct horse battery'
const NEW = 'a different long password'

class InboxMailer extends Mailer {
  readonly sent: Email[] = []
  constructor() {
    super({})
  }
  override async send(message: Email) {
    this.sent.push(message)
  }
}

const inbox = new InboxMailer()
const sessions = new SessionsService(prisma)
const tokens = new AuthTokensService(prisma)
const auth = new AuthService(prisma, sessions, tokens, inbox)

const register = (label: string) => auth.register(registerRequestSchema.parse({ email: email(label), password: OLD }))
const login = (label: string, password: string) =>
  auth.login(loginRequestSchema.parse({ email: email(label), password }))
const reset = (token: string, password = NEW) => auth.resetPassword(resetPasswordRequestSchema.parse({ token, password }))

function resetTokenSentTo(address: string): string {
  const message = inbox.sent.filter((m) => m.to === address && m.text.includes('/auth/reset-password')).at(-1)
  const link = message?.text.split('\n').find((line) => line.startsWith('http'))
  const token = link && new URL(link).searchParams.get('token')
  if (!token) throw new Error(`no reset link sent to ${address}`)
  return token
}

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('password reset', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `reset-test-${run}-` } } })
    await prisma.$disconnect()
  })

  it('replaces the password, ends every other session, and signs this browser in', async () => {
    const { token: elsewhere, user } = await register('happy')
    await auth.sendPasswordReset(email('happy'))

    const signedIn = await reset(resetTokenSentTo(email('happy')))

    expect(signedIn.user).toMatchObject({ id: user.id, emailVerified: true })
    expect(await sessions.validate(elsewhere)).toBeNull()
    expect((await sessions.validate(signedIn.token))?.id).toBe(user.id)
    await expect(login('happy', OLD)).rejects.toBeInstanceOf(UnauthorizedException)
    expect((await login('happy', NEW)).user.id).toBe(user.id)
  })

  it('works once', async () => {
    await register('once')
    await auth.sendPasswordReset(email('once'))
    const token = resetTokenSentTo(email('once'))
    await reset(token)
    const second = await reset(token, 'yet another long one').catch((error: unknown) => error)
    expect(second).toBeInstanceOf(BadRequestException)
    expect(((second as BadRequestException).getResponse() as { reason: string }).reason).toBe('used')
  })

  it('sends nothing for an address with no account, and does not throw', async () => {
    const before = inbox.sent.length
    await auth.sendPasswordReset(email('nobody'))
    expect(inbox.sent.length).toBe(before)
  })

  it('lets a Google- or GitHub-only account set its first password', async () => {
    await prisma.user.create({ data: { email: email('oauth-only') } })
    await auth.sendPasswordReset(email('oauth-only'))
    await reset(resetTokenSentTo(email('oauth-only')))
    expect((await login('oauth-only', NEW)).user.email).toBe(email('oauth-only'))
  })

  it('refuses a link older than an hour, and a verification link', async () => {
    const { user } = await register('stale')
    const stale = await tokens.issue(user.id, 'reset_password', new Date(Date.now() - AUTH_TOKEN_TTL_MS.reset_password - 1000))
    await expect(reset(stale)).rejects.toBeInstanceOf(BadRequestException)

    const verify = await tokens.issue(user.id, 'verify_email')
    await expect(reset(verify)).rejects.toBeInstanceOf(BadRequestException)
    expect((await login('stale', OLD)).user.id).toBe(user.id)
  })

  it('holds the new password to the registration rule', () => {
    expect(resetPasswordRequestSchema.safeParse({ token: 't', password: 'short' }).success).toBe(false)
  })
})
