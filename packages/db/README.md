# @jobsearch/db

Prisma schema and client for the ingestion pipeline (PLAN.md §4).

**Importable only from `apps/api` and `apps/worker`.** `apps/web` is a BFF and
is forbidden from depending on this package; CI enforces it
(`pnpm boundaries`, rule `web-must-not-touch-db`). See PLAN.md D5.

## Watching source health

```bash
pnpm --filter @jobsearch/worker worker health
```

Exits non-zero when a source is failing or overdue, so a scheduler can act on
it. `failureStreak` and `lastError` were being recorded and read by nobody; a
source that quietly stops returning results is how an index rots without anyone
noticing (PLAN.md §7).

## Local database

```bash
pnpm db:up        # start Postgres (pgvector/pgvector:pg17) on :5433
pnpm db:migrate   # apply migrations
pnpm db:studio    # browse the data
pnpm db:down      # stop, keeping the volume
```

Port **5433**, not 5432 — a dev machine usually already has a Postgres on the
default port.

## Things Prisma cannot express

Three pieces live as raw SQL appended to the migration rather than in
`schema.prisma`. They are in the migration, not applied by hand, so a fresh
database and a migrated one are identical.

| | Why it is raw SQL |
|---|---|
| `CHECK` — a `confirmed` verdict must carry an evidence snippet | Prisma has no check constraints. This is the product's core claim; the Zod schema refuses it at the API boundary, this refuses it for anything that bypasses the API |
| `tsvector` trigger + GIN index on `jobs` | Prisma has no `tsvector` type. Weighted: title A, skills B, description C |
| HNSW index on `jobs.embedding` | Prisma has no `vector` type |

## Working with vectors

`embedding` is `Unsupported("vector(1024)")`, so the typed client cannot read or
write it — that goes through `$queryRaw` / `$executeRaw`. Normal for pgvector +
Prisma, and the reason M3's matching query will be raw SQL rather than the query
builder.

Dimension is 1024 for Cohere `embed-v4.0` (PLAN.md D13). pgvector 0.8.6 caps
HNSW at 2000 dimensions for `vector`, so there is headroom.

## ⚠️ Prisma drops raw-SQL indexes

**Every migration silently drops any index Prisma cannot see in
`schema.prisma`.** It diffs indexes; the HNSW and GIN indexes are raw SQL
because Prisma has no `vector` or `tsvector` type, so it reads them as drift and
drops them in the `DropIndex` block it generates.

This is not hypothetical — the second migration dropped both, and it turned up
only because the index list was checked by hand afterwards. Nothing failed; the
database simply became slower in a way that would surface as a mysterious
performance problem months later.

Triggers and CHECK constraints survive, because Prisma does not diff those.

**So: after generating any migration, read the `DropIndex` lines, and re-create
anything raw at the bottom of the same migration.** `pnpm db:verify` asserts the
expected objects exist and runs as part of `pnpm db:migrate`, and CI runs
migrations against a real Postgres so a dropped index fails the build rather
than being noticed later.

## One database across worktrees

`docker-compose.yml` pins `name: jobsearch`. Compose otherwise derives the
project name from the directory, and all work happens in git worktrees under
`.claude/worktrees/<branch>` — so each branch created its own volume while
sharing one container name, silently reusing whichever database existed first.
`down -v` from one worktree then did not reset what another had created.

## Changing the schema

```bash
pnpm --filter @jobsearch/db exec prisma migrate dev --name what_changed --create-only
# 1. read the DropIndex lines — re-create any raw-SQL index it dropped
# 2. add anything else Prisma cannot express
pnpm db:migrate   # applies, then runs db:verify
```

`--create-only` first, always: it is the only chance to review what Prisma
decided to do before it does it, and the only place to add raw SQL.
