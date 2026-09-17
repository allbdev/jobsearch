import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import type { OAuthProvider, PrismaClient, User } from '@jobsearch/db'
import type { Account, DeleteAccountRequest } from '@jobsearch/shared'
import { DELETE_ACCOUNT_CONFIRMATION, accountSchema } from '@jobsearch/shared'
import { verifyPassword } from '../auth/passwords'
import { PRISMA } from '../prisma/prisma.module'

@Injectable()
export class AccountService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async summary(user: User): Promise<Account> {
    const connections = await this.prisma.oAuthAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { provider: true, createdAt: true },
    })
    return accountSchema.parse({
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      hasPassword: user.passwordHash !== null,
      connections: connections.map((row) => ({ provider: row.provider, linkedAt: row.createdAt.toISOString() })),
    })
  }

  /**
   * Unlinks a provider, unless it is the only way back in.
   *
   * An account with no password and no providers can still be signed in *right
   * now* -- the session is open -- and never again afterwards. Refusing is the
   * only answer that does not lock someone out of their own account by accident.
   */
  async unlink(user: User, provider: OAuthProvider): Promise<void> {
    const linked = await this.prisma.oAuthAccount.findMany({ where: { userId: user.id }, select: { provider: true } })
    if (!linked.some((row) => row.provider === provider)) {
      throw new BadRequestException({ message: `${provider} is not linked`, reason: 'not_linked' })
    }
    if (!user.passwordHash && linked.length === 1) {
      throw new BadRequestException({
        message: 'this is the only way to sign in to this account',
        reason: 'last_way_in',
      })
    }
    await this.prisma.oAuthAccount.deleteMany({ where: { userId: user.id, provider } })
  }

  /**
   * Deletes the account and everything hanging off it.
   *
   * Every user-owned table cascades (#44, #46, #49, #67), so this is one row
   * going away: profile, feeds, sessions, OAuth links, emailed tokens and the
   * saved/applied/dismissed history with it. Jobs are not user data and stay.
   */
  async remove(user: User, request: DeleteAccountRequest): Promise<void> {
    if (user.passwordHash) {
      const correct = request.password ? await verifyPassword(user.passwordHash, request.password) : false
      if (!correct) {
        throw new BadRequestException({ message: 'the password is not correct', reason: 'wrong_password' })
      }
    } else if (request.confirm !== DELETE_ACCOUNT_CONFIRMATION) {
      // Nothing to prove but intent: an account that has only used Google or
      // GitHub has no password to ask for.
      throw new BadRequestException({
        message: `type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`,
        reason: 'confirmation_required',
      })
    }

    await this.prisma.user.delete({ where: { id: user.id } })
  }
}
