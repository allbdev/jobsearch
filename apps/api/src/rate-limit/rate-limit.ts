import type { ExecutionContext } from '@nestjs/common'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'
import { Throttle } from '@nestjs/throttler'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** The address a request's body names, normalised the way the schemas store it. */
function emailIn(context: ExecutionContext): string | null {
  const body = context.switchToHttp().getRequest<{ body?: { email?: unknown } }>().body
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null
}

/**
 * Two limits on every auth route, counted separately.
 *
 * `ip` stops one machine hammering the API. `account` stops many machines
 * hammering one address: credential stuffing rotates IPs, and a forgot-password
 * form that anyone can point at anyone's inbox needs a ceiling per inbox, not
 * per sender. The account limit applies only where a request names an email.
 *
 * `req.ip` is the browser's address only because `main.ts` trusts the web's
 * `X-Forwarded-For`. Every request reaches the API from the web server, so
 * without that this would be one shared bucket for all users.
 *
 * In-memory: correct for one API instance. A second instance needs a shared
 * store (PLAN.md D8 names Redis as the thing to add when a second reason for it
 * appears; this would be one).
 */
export const RATE_LIMITS: ThrottlerModuleOptions = {
  errorMessage: 'too many attempts, try again later',
  throttlers: [
    { name: 'ip', ttl: MINUTE, limit: 30 },
    {
      name: 'account',
      ttl: 15 * MINUTE,
      limit: 10,
      skipIf: (context) => emailIn(context) === null,
      getTracker: (_req, context) => `email:${emailIn(context)}`,
    },
  ],
}

/** Per-route limits, where the default is too generous for what the route costs someone. */
export const Limit = {
  /** Account creation: few legitimate reasons to make many from one address. */
  register: () => Throttle({ ip: { ttl: HOUR, limit: 10 } }),
  /** Sends an email to someone else's inbox, so the tightest ceiling. */
  forgotPassword: () => Throttle({ ip: { ttl: 15 * MINUTE, limit: 5 }, account: { ttl: HOUR, limit: 3 } }),
  /** Sends an email, to the caller's own inbox. */
  resendVerification: () => Throttle({ ip: { ttl: HOUR, limit: 5 } }),
  /** Checks a password, so it is a guessing surface for whoever holds a session. */
  changePassword: () => Throttle({ ip: { ttl: 15 * MINUTE, limit: 5 } }),
  /** Open to the world by design, so it gets a ceiling rather than a guard. */
  unsubscribe: () => Throttle({ ip: { ttl: 15 * MINUTE, limit: 20 } }),
}
