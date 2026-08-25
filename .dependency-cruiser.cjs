/**
 * Architectural boundaries, enforced in CI (PLAN.md §6).
 *
 * The rule that matters most: `apps/web` must never reach the database. The
 * design decision (D5) is that Next is a BFF — it renders on the server but
 * talks to `apps/api` over HTTP. That boundary decays if it is only a
 * convention, because the shorter path is always four lines shorter. Here it
 * is a red build.
 */
module.exports = {
  forbidden: [
    {
      name: 'web-must-not-touch-db',
      severity: 'error',
      comment:
        'apps/web is a BFF (PLAN.md D5). It may not import the database layer or ' +
        'domain internals — it calls apps/api over HTTP via src/server/api-client.ts.',
      from: { path: '^apps/web' },
      to: { path: '^(packages/db|packages/core)' },
    },
    {
      name: 'core-must-stay-pure',
      severity: 'error',
      comment:
        'packages/core is framework-free domain logic (PLAN.md §6). No Prisma, no Nest, no React.',
      from: { path: '^packages/core' },
      to: { path: 'node_modules/(@prisma|@nestjs|react|next)' },
    },
    {
      name: 'ui-must-not-depend-on-next',
      severity: 'error',
      comment:
        'The component library stays router-agnostic. Pass `linkComponent` instead of importing next/link.',
      from: { path: '^packages/ui' },
      to: { path: 'node_modules/next' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$',
          '\\.module\\.css$',
          // Next.js file-convention entry points are reached by the framework,
          // not by an import.
          '^apps/web/(next\\.config\\.ts|src/app/.*/(layout|page|not-found|error)\\.tsx?$)',
          '^apps/web/src/app/(layout|page)\\.tsx$',
          // A workspace package's barrel is an entry point by definition.
          '^packages/[^/]+/src/index\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|\\.next|dist)' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    // Follow `import type` edges — without this, type-only modules read as orphans.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
