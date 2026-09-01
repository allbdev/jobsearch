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
      to: { path: 'node_modules/(@prisma|@nestjs|react|next|@anthropic-ai)' },
    },
    {
      name: 'ui-must-not-depend-on-next',
      severity: 'error',
      comment:
        'The component library stays framework-agnostic: no `next`, and no Next-coupled ' +
        'runtime such as `next-intl` either. Pass `linkComponent` instead of next/link, and ' +
        'supply translated strings through UiLabelsProvider instead of a translation hook. ' +
        'The pattern matches the bare module name as well as a node_modules path, because an ' +
        'import of a package the library does not depend on resolves to neither.',
      from: { path: '^packages/ui' },
      to: { path: '(^|/node_modules/)next(-|/|$)' },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment:
        'An import that does not resolve is a bug -- and it silently escapes every other rule ' +
        'here, since those match on the resolved path. A `next-intl` import inside packages/ui ' +
        'passed CI for exactly this reason.',
      from: {},
      to: { couldNotResolve: true },
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
    // `.claude/worktrees` holds nested checkouts of this same repo -- cruising
    // into them would report every module twice.
    exclude: { path: '(node_modules|\\.next|dist|\\.claude/worktrees)' },
    // See tsconfig.depcruise.json for why this is not tsconfig.base.json.
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    // Follow `import type` edges — without this, type-only modules read as orphans.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
