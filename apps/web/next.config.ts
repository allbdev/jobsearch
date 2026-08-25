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

  /**
   * Worktrees live at `<repo>/.claude/worktrees`, so a dev server started in
   * the primary checkout would otherwise watch every nested checkout -- each
   * with its own node_modules and .next. That is a large amount of wasted
   * file-watching, and edits in one worktree would trigger rebuilds in another.
   */
  webpack: (config) => {
    // Next's default is a RegExp; webpack rejects an array that mixes a RegExp
    // with glob strings, so each shape has to be handled on its own terms.
    // NOTE: this covers `next dev` on webpack. If the dev script ever adds
    // --turbopack, this hook stops applying and the exclusion needs redoing.
    const previous = config.watchOptions?.ignored
    const ours = /[\\/]\.claude[\\/]worktrees[\\/]/

    config.watchOptions = {
      ...config.watchOptions,
      ignored:
        previous instanceof RegExp
          ? new RegExp(`(?:${previous.source})|(?:${ours.source})`)
          : Array.isArray(previous)
            ? [...previous, '**/.claude/worktrees/**']
            : ours,
    }
    return config
  },

  outputFileTracingExcludes: {
    '*': ['./.claude/worktrees/**'],
  },
}

export default config
