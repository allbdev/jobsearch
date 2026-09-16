import type { NestExpressApplication } from '@nestjs/platform-express'

/**
 * Settings the running service and the HTTP tests must share, so a test cannot
 * pass against an app configured differently from the one that ships.
 */
export function configureApp(app: NestExpressApplication): void {
  // Believe `X-Forwarded-For` only from these hops. Every request arrives via the
  // web server, so without this `req.ip` is the web's address and rate limits
  // become one bucket shared by every user. Name the web's network here in
  // production -- trusting any peer lets a client pick its own IP.
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback')
  app.enableShutdownHooks()
}
