import { createHash, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import type { AuthTokenPurpose, PrismaClient } from '@jobsearch/db'
import type { EmailTokenFailure } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'

const HOUR = 3_600_000

/** How long an emailed link works. A reset link grants an account, so it is short. */
export const AUTH_TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  verify_email: 24 * HOUR,
  reset_password: 1 * HOUR,
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export type ConsumeResult = { ok: true; userId: string } | { ok: false; reason: EmailTokenFailure }

/** Single-use tokens for emailed links, stored hashed like sessions (D15). */
@Injectable()
export class AuthTokensService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Issues a token and retires any earlier unused one, so only the newest email works. */
  async issue(userId: string, purpose: AuthTokenPurpose, now = new Date()): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
      this.prisma.authToken.create({
        data: { id: hash(token), userId, purpose, expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL_MS[purpose]) },
      }),
    ])
    return token
  }

  /**
   * Marks a token used, exactly once. The conditional update is the check: two
   * clicks racing on the same link both read "unused", and only one of them can
   * win the write.
   */
  async consume(token: string, purpose: AuthTokenPurpose, now = new Date()): Promise<ConsumeResult> {
    const id = hash(token)
    const { count } = await this.prisma.authToken.updateMany({
      where: { id, purpose, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })

    const row = await this.prisma.authToken.findUnique({ where: { id } })
    if (count === 1 && row) return { ok: true, userId: row.userId }
    if (!row || row.purpose !== purpose) return { ok: false, reason: 'invalid' }
    return { ok: false, reason: row.usedAt ? 'used' : 'expired' }
  }
}
