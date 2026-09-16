import { randomUUID } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { registerRequestSchema } from '@jobsearch/shared'
import { AUTH_TOKEN_TTL_MS, AuthTokensService } from '../src/auth/auth-tokens.service'
import { AuthService } from '../src/auth/auth.service'
import { SessionsService } from '../src/auth/sessions.service'
import type { Email } from '../src/email/mailer'
import { Mailer } from '../src/email/mailer'

const run = randomUUID().slice(0, 8)
const email = (label: string) => `verify-test-${run}-${label}@example.test`

/** Captures what would have been sent, so the test can click the link. */
class InboxMailer extends Mailer {
  readonly sent: Email[] = []
  constructor() {
    super({})
  }
  override async send(message: Email) {
    this.sent.push(message)
  }
}

const tokens = new AuthTokensService(prisma)
const inbox = new InboxMailer()
const auth = new AuthService(prisma, new SessionsService(prisma), tokens, inbox)

const register = (label: string) =>
  auth.register(registerRequestSchema.parse({ email: email(label), password: 'correct horse battery' }))

/** The token out of the newest email to an address, as a click on its link would carry it. */
function tokenSentTo(address: string): string {
  const message = inbox.sent.filter((m) => m.to === address).at(-1)
  const link = message?.text.split('\n').find((line) => line.startsWith('http'))
  const token = link && new URL(link).searchParams.get('token')
  if (!token) throw new Error(`no link sent to ${address}`)
  return token
}

const reason = (promise: Promise<unknown>) =>
  promise.then(
    () => 'accepted',
    (error: unknown) => {
      expect(error).toBeInstanceOf(BadRequestException)
      return ((error as BadRequestException).getResponse() as { reason: string }).reason
    },
  )

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('email verification', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `verify-test-${run}-` } } })
    await prisma.$disconnect()
  })

  it('emails a link on registration that verifies the address once', async () => {
    const { user } = await register('happy')
    const token = tokenSentTo(email('happy'))

    expect(await auth.verifyEmail(token)).toMatchObject({ id: user.id, emailVerified: true })
    expect(await reason(auth.verifyEmail(token))).toBe('used')
  })

  it('stores only the hash of the emailed token', async () => {
    await register('hashed')
    expect(await prisma.authToken.findUnique({ where: { id: tokenSentTo(email('hashed')) } })).toBeNull()
  })

  it('retires the earlier link when a new one is sent', async () => {
    const { user } = await register('resend')
    const first = tokenSentTo(email('resend'))
    await auth.resendVerification(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
    const second = tokenSentTo(email('resend'))

    expect(second).not.toBe(first)
    expect(await reason(auth.verifyEmail(first))).toBe('invalid')
    expect((await auth.verifyEmail(second)).emailVerified).toBe(true)
  })

  it('sends nothing to an address that is already verified', async () => {
    const { user } = await register('done')
    await auth.verifyEmail(tokenSentTo(email('done')))
    const before = inbox.sent.length
    await auth.resendVerification(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
    expect(inbox.sent.length).toBe(before)
  })

  it('refuses an expired link, a made-up one, and one issued for another purpose', async () => {
    const { user } = await register('expired')
    const issued = new Date(Date.now() - AUTH_TOKEN_TTL_MS.verify_email - 1000)
    const stale = await tokens.issue(user.id, 'verify_email', issued)
    expect(await reason(auth.verifyEmail(stale))).toBe('expired')
    expect(await reason(auth.verifyEmail('not-a-token'))).toBe('invalid')

    const reset = await tokens.issue(user.id, 'reset_password')
    expect(await reason(auth.verifyEmail(reset))).toBe('invalid')
  })

  it('lets exactly one of two simultaneous clicks through', async () => {
    const { user } = await register('race')
    const token = await tokens.issue(user.id, 'verify_email')
    const results = await Promise.all([tokens.consume(token, 'verify_email'), tokens.consume(token, 'verify_email')])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
  })

  it('still creates the account when the email cannot be sent', async () => {
    const broken = new AuthService(prisma, new SessionsService(prisma), tokens, new (class extends Mailer {
      override async send(): Promise<void> {
        throw new Error('provider down')
      }
    })({}))
    const created = await broken.register(registerRequestSchema.parse({ email: email('down'), password: 'correct horse battery' }))
    expect(created.token).toBeTruthy()
  })
})
