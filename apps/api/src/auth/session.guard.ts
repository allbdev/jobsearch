import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import type { User } from '@jobsearch/db'
import { SessionsService } from './sessions.service'

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>
  user?: User
  sessionToken?: string
}

/**
 * Requires `Authorization: Bearer <token>`. The API reads no cookies: the web
 * holds the cookie and forwards it (D15), which keeps this service usable by a
 * client that is not a browser.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const header = request.headers.authorization
    const token = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header)?.[1] : undefined
    if (!token) throw new UnauthorizedException('sign in required')

    const user = await this.sessions.validate(token)
    if (!user) throw new UnauthorizedException('session expired')

    request.user = user
    request.sessionToken = token
    return true
  }
}

/** The signed-in user. Only meaningful behind `SessionGuard`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)

/** The raw bearer token, for signing out. Only meaningful behind `SessionGuard`. */
export const SessionToken = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AuthenticatedRequest>().sessionToken,
)
