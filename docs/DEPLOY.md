# Deploying

**Neon** (Postgres) · **Fly.io** (API + worker) · **Vercel** (web).

Everything below is free-tier sized. The numbers that decide that are in
[Keeping the database asleep](#keeping-the-database-asleep) — read it before
changing how often anything runs.

---

## Order

A later step needs the URL the previous one produced, so the order matters.

### 1. Postgres on Neon

1. Create a project. **Pick the region first** — Fly's app should sit beside it,
   and moving either later means a migration.
2. Enable pgvector once, from the SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
   The schema's `vector(1024)` column (D13) fails to migrate without it.
3. Copy the **pooled** connection string. Prisma opens a connection per process,
   and a suspended Fly machine resuming holds one; the pooler is what keeps that
   from exhausting the database.
4. Leave autosuspend at its default (5 minutes idle).

Migrations are applied by the API's release step, not by hand.

### 2. API on Fly

```bash
cd apps/api
fly launch --no-deploy --copy-config      # app name from fly.toml: jobsearch-api
fly secrets set DATABASE_URL="postgresql://…"        # the pooled URL
fly secrets set RESEND_API_KEY="…" EMAIL_FROM="JobSearch <no-reply@yourdomain>"
fly secrets set GOOGLE_CLIENT_ID="…" GOOGLE_CLIENT_SECRET="…"
fly secrets set GITHUB_CLIENT_ID="…" GITHUB_CLIENT_SECRET="…"
fly secrets set WEB_URL="https://your-web-domain"     # where emailed links point
fly deploy
```

`fly.toml` already sets `API_PORT`, and `TRUST_PROXY` to the networks Fly's
proxy speaks from — without that the rate limits (#54) key on the proxy and
throttle every user together.

The deploy runs `prisma migrate deploy` before the new version serves traffic.
It applies what exists and never generates or resets.

Check it: `curl https://jobsearch-api.fly.dev/health` → `{"status":"ok",…}`.

### 3. Web on Vercel

Import the repo, root directory `apps/web`, and set:

| Variable | Value |
|---|---|
| `API_URL` | `https://jobsearch-api.fly.dev` |
| `NEXT_PUBLIC_SITE_URL` | the site's own origin — read at **build** time |

Then set the API's `WEB_URL` to this origin (`fly secrets set WEB_URL=…`), so
emailed links and OAuth callbacks point back here.

### 4. The worker, on a schedule

```bash
cd apps/worker
fly launch --no-deploy --copy-config       # jobsearch-worker
fly secrets set DATABASE_URL="…" RESEND_API_KEY="…" EMAIL_FROM="…" WEB_URL="https://your-web-domain"
fly deploy --ha=false                      # builds the image; runs nothing

fly machine run . --schedule hourly \
  --command "sh -c 'pnpm --filter @jobsearch/worker worker cycle && pnpm --filter @jobsearch/worker worker digest'"
```

One machine, one wake-up an hour, both jobs. `worker cycle` skips any source
whose poll interval is not due (6 hours today), so the crawl still runs four
times a day while the database is woken once an hour for a couple of seconds of
digest queries.

### 5. Providers and senders

- **Google**: add `https://your-web-domain/auth/callback/google` to the OAuth
  client's authorized redirect URIs. The localhost one can stay.
- **GitHub**: same for `…/auth/callback/github`.
- **Resend**: verify a domain and set `EMAIL_FROM` to an address on it.
  `onboarding@resend.dev` only ever delivers to your own Resend account, which
  is fine for testing and useless for users.

---

## Keeping the database asleep

Neon bills **compute time**, and a project sleeps only after ~5 minutes with no
queries. Anything that runs every few minutes therefore keeps it awake all
month: a job every 15 minutes is ~720 compute-hours, far past the free
allowance, for a handful of seconds of actual work.

The schedule above is built around that:

| | every | database awake |
|---|---|---|
| `worker cycle` (crawl, classify, verify) | 6h, inside the hourly machine | ~4 × 10 min |
| `worker digest` | 1h | 24 × ~5 min (the idle timeout, not the query) |

≈ **60–80 compute-hours a month**, plus whatever real visitors cause — inside
Neon's free allowance, which is ~191 compute-hours.

**If you make anything more frequent, do the arithmetic again.** Every wake-up
costs at least the 5-minute idle timeout, whatever the query took.

Storage is not the constraint: the index is 147 MB with ~3,500 postings, against
500 MB free.

---

## What each service needs

| | API (Fly) | worker (Fly) | web (Vercel) |
|---|---|---|---|
| `DATABASE_URL` | ✓ | ✓ | — (D5: the web never touches Postgres) |
| `WEB_URL` | ✓ emailed links, OAuth callbacks | ✓ digest links | — |
| `API_URL` | — | — | ✓ |
| `NEXT_PUBLIC_SITE_URL` | — | — | ✓ at build time |
| `RESEND_API_KEY`, `EMAIL_FROM` | ✓ verification, reset | ✓ digest | — |
| `GOOGLE_*`, `GITHUB_*` | ✓ | — | — |
| `ANTHROPIC_API_KEY` | — | ✓ only for `classify --llm` | — |
| `TRUST_PROXY` | ✓ set in fly.toml | — | — |

---

## Running the paid pass

Never part of the schedule (COSTS.md). When you want the `needs_check` backlog
settled:

```bash
fly machine run . --command "pnpm --filter @jobsearch/worker worker classify --llm"
```

It prints what it spent. At the time of writing that backlog is ~105 postings.

---

## Rollback

`fly releases` then `fly deploy --image <previous>`; or `fly apps restart`.

**Migrations do not roll back.** Prisma has no down-migrations here, by choice:
the schema only ever moves forward, and a release that must be undone is undone
in the app, not the database.
