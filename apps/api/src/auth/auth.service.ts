import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import type { PrismaClient, User } from '@jobsearch/db'
import { Prisma } from '@jobsearch/db'
import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SessionResponse,
  SessionUser,
} from '@jobsearch/shared'
import { Mailer } from '../email/mailer'
import { resetPassword, verifyEmail } from '../email/templates'
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
   * Emails a reset link if the address has an account, and does nothing if not.
   *
   * The controller does not wait for this: it answers 204 at once, whether or
   * not the address exists, so neither the response nor its timing says which.
   * An account with no password (Google or GitHub only) gets a link too --
   * proving control of the address is exactly what setting one requires.
   */
  async sendPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) return
    const token = await this.tokens.issue(user.id, 'reset_password')
    await this.mailer.send(resetPassword(user.email, token))
  }

  /**
   * Sets a new password, ends every existing session, and signs this browser in.
   *
   * Following the link proves control of the address, so it also verifies it.
   */
  async resetPassword(request: ResetPasswordRequest): Promise<SessionResponse> {
    const result = await this.tokens.consume(request.token, 'reset_password')
    if (!result.ok) throw new BadRequestException({ message: 'email link not accepted', reason: result.reason })

    const passwordHash = await hashPassword(request.password)
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: result.userId } })
    const user = await this.prisma.user.update({
      where: { id: result.userId },
      data: { passwordHash, emailVerifiedAt: current.emailVerifiedAt ?? new Date() },
    })
    // A reset is often *because* someone else is signed in.
    await this.sessions.revokeAll(user.id)
    return this.startSession(user)
  }

  /**
   * Replaces the password of a signed-in user who can prove the current one,
   * and signs out everywhere else.
   *
   * An account with no password -- created through Google or GitHub -- is
   * refused with a reason rather than allowed to set one here: a stolen session
   * could otherwise add a password and keep the account after the session is
   * revoked. Setting a first password goes through the emailed reset link (#52),
   * which proves control of the address.
   */
  async changePassword(user: User, sessionToken: string, request: ChangePasswordRequest): Promise<void> {
    if (!user.passwordHash) {
      throw new BadRequestException({ message: 'this account has no password yet', reason: 'no_password' })
    }
    if (!(await verifyPassword(user.passwordHash, request.currentPassword))) {
      throw new BadRequestException({ message: 'the current password is not correct', reason: 'wrong_password' })
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(request.newPassword) },
    })
    await this.sessions.revokeOthers(user.id, sessionToken)
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

  async startSession(user: User): Promise<SessionResponse> {
    const { token, expiresAt } = await this.sessions.create(user.id)
    return { token, expiresAt: expiresAt.toISOString(), user: toSessionUser(user) }
  }
}

export function toSessionUser(user: User): SessionUser {
  return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerifiedAt !== null }
}
