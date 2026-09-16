import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { PrismaClient, User } from '@jobsearch/db'
import { Prisma } from '@jobsearch/db'
import type { LoginRequest, RegisterRequest, SessionResponse, SessionUser } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'
import { hashPassword, verifyAgainstNothing, verifyPassword } from './passwords'
import { SessionsService } from './sessions.service'

/** One message for every failed sign-in, so it cannot tell which half was wrong. */
const INVALID_CREDENTIALS = 'invalid email or password'

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly sessions: SessionsService,
  ) {}

  async register(request: RegisterRequest): Promise<SessionResponse> {
    const passwordHash = await hashPassword(request.password)
    try {
      const user = await this.prisma.user.create({
        data: { email: request.email, name: request.name ?? null, passwordHash },
      })
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

  private async startSession(user: User): Promise<SessionResponse> {
    const { token, expiresAt } = await this.sessions.create(user.id)
    return { token, expiresAt: expiresAt.toISOString(), user: toSessionUser(user) }
  }
}

export function toSessionUser(user: User): SessionUser {
  return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerifiedAt !== null }
}
