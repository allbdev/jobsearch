import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { PrismaClient, User } from '@jobsearch/db'
import { PRISMA } from '../../prisma/prisma.module'
import { SessionsService } from '../sessions.service'
import type { OAuthIdentity } from './providers'

/**
 * Turns a provider identity into one of our users, per D15.
 *
 * Separate from the provider calls so the part that decides *whose account
 * this is* can be tested without Google.
 */
@Injectable()
export class OAuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly sessions: SessionsService,
  ) {}

  async userFor(identity: OAuthIdentity, now = new Date()): Promise<User> {
    const { provider, providerUserId } = identity

    // 1. Seen this identity before: its user, whatever the email says today.
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    })
    if (linked) return linked.user

    // Every path below trusts the email, so it must be one the provider vouches for.
    if (!identity.email || !identity.emailVerified) {
      throw new ForbiddenException({
        message: `${provider} did not confirm an email address for this account`,
        reason: 'email_unverified',
      })
    }

    const existing = await this.prisma.user.findUnique({ where: { email: identity.email } })

    // 2. A new person: an account whose address is verified by construction.
    if (!existing) {
      return this.prisma.user.create({
        data: {
          email: identity.email,
          name: identity.name,
          emailVerifiedAt: now,
          oauthAccounts: { create: { provider, providerUserId } },
        },
      })
    }

    // 3. An existing account with this address. If that account never proved it
    // owns the address, whoever registered it may not be this person: drop its
    // password and sessions before handing it over (pre-hijacking, D15).
    const unproven = existing.emailVerifiedAt === null
    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        oauthAccounts: { create: { provider, providerUserId } },
        ...(unproven ? { passwordHash: null, emailVerifiedAt: now } : {}),
      },
    })
    if (unproven) await this.sessions.revokeAll(user.id)
    return user
  }
}
