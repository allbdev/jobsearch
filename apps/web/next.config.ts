import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  /**
   * Workspace packages ship TypeScript and CSS Modules rather than a build
   * artifact, so Next compiles them in place.
   *
   * `@jobsearch/db` is deliberately absent from this app's dependencies — see
   * PLAN.md D5. The web app talks to the API over HTTP and never to Postgres.
   */
  transpilePackages: ['@jobsearch/ui', '@jobsearch/shared', '@jobsearch/design-system'],
}

export default config
