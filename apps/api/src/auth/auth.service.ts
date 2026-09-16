import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import type { PrismaClient, User } from '@jobsearch/db'
import { Prisma } from '@jobsearch/db'
import type { LoginRequest, RegisterRequest, SessionResponse, SessionUser } from '@jobsearch/shared'
import { Mailer } from '../email/mailer'
import { verifyEmail } from '../email/templates'
import { PRISMA } from '../prisma/prisma.module'
import { AuthTokensService } from './auth-tokens.service'
import { hashPassword, verifyAgainstNothing, verifyPassword } from './passwords'
import { SessionsService } from './sessions.service'

/** One message for every failed sign-in, so it cannot tell which half was wrong. */
const INVALID_CREDENTIALS = 'invalid email or password'

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService')

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly sessions: SessionsService,
    private readonly tokens: AuthTokensService,
    private readonly mailer: Mailer,
  ) {}

  async register(request: RegisterRequest): Promise<SessionResponse> {
    const passwordHash = await hashPassword(request.password)
    try {
      const user = await this.prisma.user.create({
        data: { email: request.email, name: request.name ?? null, passwordHash },
      })
      await this.sendVerification(user)
      return this.startSession(user)
    } catch (error) {
      // Registration necessarily reveals that an address is taken; the sign-in
      // form is where that must not leak, and it does not.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('an account with this email already exists')
      }
      throw error
    }
  }

  async login(request: LoginRequest): Promise<SessionResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: request.email } })

    // An account that has only used Google or GitHub has no password, and is
    // answered exactly like an address that does not exist.
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, request.password)
      : await verifyAgainstNothing(request.password)

    if (!user || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS)
    return this.startSession(user)
  }

  /** Sends a fresh link. Already verified is a no-op, not an error: the goal is met. */
  async resendVerification(user: User): Promise<void> {
    if (user.emailVerifiedAt) return
    await this.sendVerification(user)
  }

  async verifyEmail(token: string): Promise<SessionUser> {
    const result = await this.tokens.consume(token, 'verify_email')
    if (!result.ok) throw new BadRequestException({ message: 'email link not accepted', reason: result.reason })

    const user = await this.prisma.user.update({
      where: { id: result.userId },
      data: { emailVerifiedAt: new Date() },
    })
    return toSessionUser(user)
  }

  /**
   * A failed send does not fail registration. The account exists either way,
   * and refusing it would leave the address taken with no way to sign in; the
   * user can ask for another link.
   */
  private async sendVerification(user: User): Promise<void> {
    try {
      const token = await this.tokens.issue(user.id, 'verify_email')
      await this.mailer.send(verifyEmail(user.email, token))
    } catch (error) {
      this.logger.error(`verification email to user ${user.id} failed: ${String(error)}`)
    }
  }

  private async startSession(user: User): Promise<SessionResponse> {
    const { token, expiresAt } = await this.sessions.create(user.id)
    return { token, expiresAt: expiresAt.toISOString(), user: toSessionUser(user) }
  }
}

export function toSessionUser(user: User): SessionUser {
  return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerifiedAt !== null }
}
