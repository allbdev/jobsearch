# @jobsearch/db

Prisma schema and client. **Placeholder** — populated at milestone M0 (PLAN.md §8).

Importable only from `apps/api` and `apps/worker`. `apps/web` is forbidden from
depending on this package, and CI enforces it (`pnpm boundaries`, rule
`web-must-not-touch-db`). See PLAN.md D5.
