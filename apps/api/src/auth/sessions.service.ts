import { createHash, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import type { PrismaClient, User } from '@jobsearch/db'
import { PRISMA } from '../prisma/prisma.module'

const DAY = 86_400_000
export const SESSION_TTL_MS = 30 * DAY
/** A session used in the second half of its life is extended to a full TTL. */
const RENEW_WITHIN_MS = 15 * DAY

/** The database key for a token. The token itself is never stored (D15). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Opaque server-side sessions (D15). */
@Injectable()
export class SessionsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async create(userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
    // 256 bits from the CSPRNG. Unguessable, so it needs no signature.
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
    await this.prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } })
    return { token, expiresAt }
  }

  /** The user a token belongs to, or null. Extends a session that is still in use. */
  async validate(token: string, now = new Date()): Promise<User | null> {
    const id = hashToken(token)
    const session = await this.prisma.session.findUnique({ where: { id }, include: { user: true } })
    if (!session) return null

    if (session.expiresAt <= now) {
      await this.prisma.session.deleteMany({ where: { id } })
      return null
    }

    if (session.expiresAt.getTime() - now.getTime() < RENEW_WITHIN_MS) {
      await this.prisma.session.update({
        where: { id },
        data: { expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
      })
    }
    return session.user
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: hashToken(token) } })
  }

  /** Signs a user out everywhere: after a password reset, nothing signed in before it should survive. */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } })
  }
}
