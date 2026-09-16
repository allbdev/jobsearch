import { randomUUID } from 'node:crypto'
import { ForbiddenException } from '@nestjs/common'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@jobsearch/db'
import { OAuthService } from '../src/auth/oauth/oauth.service'
import type { OAuthIdentity } from '../src/auth/oauth/providers'
import { SessionsService } from '../src/auth/sessions.service'

const run = randomUUID().slice(0, 8)
const email = (label: string) => `oauth-test-${run}-${label}@example.test`
const sessions = new SessionsService(prisma)
const oauth = new OAuthService(prisma, sessions)

const identity = (label: string, overrides: Partial<OAuthIdentity> = {}): OAuthIdentity => ({
  provider: 'google',
  providerUserId: `${run}-${label}`,
  email: email(label),
  emailVerified: true,
  name: 'Ada',
  ...overrides,
})

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('OAuth account linking (D15)', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `oauth-test-${run}-` } } })
    await prisma.$disconnect()
  })

  it('creates a verified, password-less account for a new person', async () => {
    const user = await oauth.userFor(identity('new'))
    expect(user).toMatchObject({ email: email('new'), name: 'Ada', passwordHash: null })
    expect(user.emailVerifiedAt).not.toBeNull()
  })

  it('returns the same user for the same identity, even after its email changes', async () => {
    const first = await oauth.userFor(identity('stable'))
    const again = await oauth.userFor(identity('stable', { email: email('renamed') }))
    expect(again.id).toBe(first.id)
  })

  it('links a second provider to the account with that verified email', async () => {
    const google = await oauth.userFor(identity('both'))
    const github = await oauth.userFor(identity('both', { provider: 'github', providerUserId: `${run}-gh` }))
    expect(github.id).toBe(google.id)
    expect(await prisma.oAuthAccount.count({ where: { userId: google.id } })).toBe(2)
  })

  it('keeps the password and sessions of an account that had proven its address', async () => {
    const owner = await prisma.user.create({
      data: { email: email('proven'), passwordHash: 'kept', emailVerifiedAt: new Date() },
    })
    const { token } = await sessions.create(owner.id)
    const linked = await oauth.userFor(identity('proven'))
    expect(linked).toMatchObject({ id: owner.id, passwordHash: 'kept' })
    expect(await sessions.validate(token)).not.toBeNull()
  })

  it('takes an unproven account back from whoever registered it first', async () => {
    // Someone registers the victim's address with a password they know...
    const squatter = await prisma.user.create({ data: { email: email('squatted'), passwordHash: 'attacker' } })
    const { token } = await sessions.create(squatter.id)

    // ...then the real owner signs in with Google.
    const linked = await oauth.userFor(identity('squatted'))

    expect(linked.id).toBe(squatter.id)
    expect(linked.passwordHash).toBeNull()
    expect(linked.emailVerifiedAt).not.toBeNull()
    expect(await sessions.validate(token)).toBeNull()
  })

  it('refuses an identity whose email the provider does not vouch for', async () => {
    await prisma.user.create({ data: { email: email('victim'), passwordHash: 'x', emailVerifiedAt: new Date() } })
    await expect(oauth.userFor(identity('victim', { emailVerified: false }))).rejects.toBeInstanceOf(ForbiddenException)
    await expect(oauth.userFor(identity('no-email', { email: null }))).rejects.toBeInstanceOf(ForbiddenException)
    expect(await prisma.oAuthAccount.count({ where: { providerUserId: `${run}-victim` } })).toBe(0)
  })
})
