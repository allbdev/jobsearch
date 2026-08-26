# @jobsearch/db

Prisma schema and client for the ingestion pipeline (PLAN.md §4).

**Importable only from `apps/api` and `apps/worker`.** `apps/web` is a BFF and
is forbidden from depending on this package; CI enforces it
(`pnpm boundaries`, rule `web-must-not-touch-db`). See PLAN.md D5.

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

## Changing the schema

```bash
pnpm --filter @jobsearch/db exec prisma migrate dev --name what_changed --create-only
# edit the generated SQL if it needs anything Prisma cannot express
pnpm db:migrate
```

`--create-only` first, always: it is the only chance to review what Prisma
decided to do before it does it, and the only place to add raw SQL.
