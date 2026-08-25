# JobSearch

Remote jobs you are actually eligible for — **any profession**.

Most job boards say "Remote". They do not say whether the company will hire
someone who *lives in Brazil*. This one classifies each posting for geographic
eligibility, quotes the line in the posting that proves it, and serves each
user a personalized feed plus an email digest.

## Docs

| | |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Product, architecture, decision log, milestones, open questions |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Component library rules and inventory |
| [`packages/design-system/README.md`](packages/design-system/README.md) | The "Industry" design system and how to re-sync it |

## Status

Milestone **M0**, in progress. The frontend is built against fixtures; the
backend does not exist yet. See `PLAN.md` §8.

```bash
pnpm install
pnpm --filter @jobsearch/web dev    # http://localhost:3000
pnpm typecheck
pnpm boundaries                      # architectural rules, CI-enforced
```

## Layout

```
apps/web            ✅ Next.js — SSR/SEO, BFF only, never touches the DB
apps/api            ⬜ NestJS — owns all business logic and DB access
apps/worker         ⬜ ingest / classify / verify / digest workers
packages/design-system  ✅ "Industry", vendored from Claude Design
packages/ui             ✅ React components — every component, written once
packages/shared         ✅ Zod schemas and domain types
packages/db             ⬜ Prisma schema
packages/core           ⬜ pure domain logic
packages/sources        ⬜ one adapter per job source
```
