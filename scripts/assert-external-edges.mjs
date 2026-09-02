/**
 * Assert that dependency-cruiser can still see into node_modules.
 *
 * Three of the architectural rules are written against installed packages
 * (`node_modules/@prisma`, `node_modules/next`, ...). If those modules stop
 * entering the graph -- one word in the config does it -- the rules keep
 * passing, forever, on a graph that no longer contains anything they match.
 * That is not a hypothetical: it is how this file came to exist.
 *
 * A rule that cannot fail is worse than no rule, because it is reported as a
 * passing check. So the boundaries script also asserts the graph still has the
 * shape the rules assume.
 */
import { execFileSync } from 'node:child_process'

const raw = execFileSync(
  'pnpm',
  ['exec', 'depcruise', '--config', '.dependency-cruiser.cjs', '--output-type', 'json', 'apps', 'packages'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)

const external = JSON.parse(raw).modules.filter((module) => module.source.includes('node_modules'))

if (external.length === 0) {
  console.error(
    'boundaries self-check failed: no node_modules module is in the dependency graph.\n' +
      'The rules that forbid importing @prisma, next, react or @anthropic-ai match paths\n' +
      'under node_modules, so they can no longer fire. Check `options.exclude` in\n' +
      '.dependency-cruiser.cjs -- it must not exclude node_modules (use doNotFollow).',
  )
  process.exit(1)
}

console.log(`✔ boundaries self-check: ${external.length} external modules visible to the rules`)
