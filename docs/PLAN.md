# JobSearch — Design Plan

**Status:** design agreed; M0 in progress (frontend built, backend pending)
**Last updated:** 2026-08-25 (rev 3 — D10: design system + component library; M0 started)
**Origin:** productizing `claude_job.md` (a single-user daily Claude cron job) into a multi-user web app.

---

## 1. Product

A job aggregator for **anyone** who wants to work **remotely from their own country for companies abroad** — any profession, not just tech.

The differentiator is not "more job listings". It is **geographic eligibility, verified and cited**. Most boards tell you a job is "Remote". They do not tell you whether a company will hire someone who *lives in Brazil*. That is the question this product answers, with the evidence quoted from the posting — and it is a question a designer, a recruiter, an accountant or a support lead has just as much as an engineer.

Users create an account, describe their profile (residence, skills, target roles, contract types), and get a **personalized feed** of matched positions with external links to apply, plus an **email digest**.

### Core product loop
1. We crawl and index jobs globally, continuously.
2. We classify each job once for geographic eligibility + contract model, storing the evidence snippet.
3. Each user's feed is a query over that index, filtered by their profile.
4. An email digest brings them back.

---

## 2. Decisions

Each decision is recorded with its rationale so we can revisit it deliberately rather than by drift.

| ID | Decision | Status |
|----|----------|--------|
| D1 | Global crawl + shared index; per-user feed is a query, not a live web search | ✅ agreed |
| D2 | Backend: Node + TypeScript (NestJS) | ✅ agreed |
| D3 | Database: PostgreSQL (+ FTS, + pgvector) | ✅ agreed |
| D4 | Monorepo: Turborepo + pnpm | ✅ agreed |
| D5 | Next.js frontend as **BFF only** — never touches the DB | ✅ agreed |
| D6 | Product shape: personalized feed (not a generic search board) | ✅ agreed |
| D7 | Email digest is in v1 | ✅ agreed |
| D8 | Queue: start with pg-boss (Postgres), add Redis when a second reason appears | 🔶 provisional |
| D9 | Profession-agnostic: any occupation, not tech-only. Architecture generic from day one; verticals expand as sources allow | ✅ agreed |
| D10 | Design system "Industry", authored in Claude Design, vendored unmodified; every component written exactly once in `@jobsearch/ui` | ✅ implemented |
| D11 | i18n via locale-prefixed routes (`/en`, `/pt-br`, `/es`) with next-intl; changing language navigates | ✅ implemented |

### D1 — Global crawl, per-user query

The origin cron job fetches sources live, per run, per user. That does not survive multiple users:

- N users × same source API call → rate limits and bans
- N users × LLM classification of the *same posting* → the largest cost line, paid repeatedly for identical work
- N users × `web_fetch` of the same URL → we become a scraper nuisance

So: **eligibility is a property of the job, classified once, globally.** Matching a user is then set intersection (does the job's `eligible_countries` include the user's `residence_country`; does the stack overlap) — pure SQL plus a vector similarity term. Cost scales with *jobs*, not with *users × jobs*.

### D2 — Node/TypeScript backend

Considered Go, Node, Python.

**Chose Node** because:
- The workload is I/O-bound (HTTP fan-out, DB, LLM calls), not CPU-bound. Go's concurrency edge does not pay off when everything is waiting on sockets.
- End-to-end types across the monorepo: one set of Zod schemas shared between API and web, one toolchain, one CI pipeline. A Go backend means hand-maintaining an OpenAPI contract across a language boundary.
- The domain ecosystem is Node-native: RSS parsing, HTML extraction (Readability/cheerio), `@anthropic-ai/sdk`, BullMQ/pg-boss, Prisma.
- It doubles as a portfolio piece in the exact stack we want to showcase.

**Rejected Python:** its only real advantage is the ML stack, and hosted LLM APIs + pgvector erase that. Trading a strong language for a weaker one to gain nothing.

**Go is deliberately kept on the table for one component.** If the fetcher fleet becomes the bottleneck (thousands of concurrent fetches + HTML parsing is genuinely CPU/memory work), we rewrite *that worker only* in Go. This is why the queue must stay a clean process boundary — see §4.

### D3 — PostgreSQL

Chosen not merely as "a fine default" but because it lets us delete three services from v1:

| Need | Postgres feature | Service avoided |
|------|------------------|-----------------|
| Keyword search | `tsvector` + GIN | Elasticsearch |
| Semantic profile↔job matching | `pgvector` | Pinecone / Qdrant |
| Heterogeneous raw source payloads | `JSONB` | MongoDB |
| Background queue | pg-boss (`SKIP LOCKED`) | Redis (for now) |

Add Typesense/Meilisearch **only** if search quality becomes an actual complaint. Do not preempt.

### D5 — Next.js as BFF only

Agreed: we want SSR (SEO-indexable job pages are a real growth channel for a job board) **without** the frontend owning data access.

The risk is concrete. Next's App Router ships four server surfaces where backend logic can legally live — RSCs, Route Handlers, Server Actions, `middleware.ts`. A Server Action that imports Prisma is four lines and fully typed; the equivalent API call is an endpoint, a DTO, a client function, and error handling. The shorter path wins by default, and the boundary erodes into: two writers to one database bypassing each other's invariants, two auth implementations that drift, and no principled answer to "where does this new endpoint go?"

**The rule:** `apps/web` does not depend on `@repo/db`. RSCs and Server Actions call the API over an internal HTTP URL (same region, low single-digit ms, cacheable via `revalidate`).

**Enforcement is mechanical, not cultural.** Boundaries kept by discipline decay — especially this one, since the wrong choice is always shorter. So:
- `@repo/db` is absent from `apps/web/package.json` → the import fails at build time.
- CI runs a dependency-boundary check (dependency-cruiser or `no-restricted-imports`) so a violation is a red build, not something a reviewer has to catch.

Accepted trade-off: removing the API layer is RSC's headline value proposition, and we are opting out of it. We pay Next's complexity for SSR/SEO and typed data fetching only. That is a conscious price for having one owner of business logic and an API that is already ready for a second surface (mobile, public API, partner integration).

### D6 — Personalized feed

The product is the **matching engine**, not the index size. Effort goes into eligibility accuracy and match quality, not into breadth of search UI. A user should be able to open the app and see a short, high-signal list, in the spirit of the origin prompt's "quality > quantity: better 6 verified jobs than 15 broken links."

Generic search exists, but as a secondary affordance.

### D7 — Email digest

The origin cron job's actual delivery mechanism was a message, not a website. The digest is what creates the habit; the web app is where the user acts. Shipping the feed without the digest ships a site nobody returns to.

### D9 — Profession-agnostic

The product serves **any occupation**. Engineering is where the origin prompt started and where our sources are currently strongest — it is a seed vertical, not the scope.

What this changes:

- **Sources.** Most of Tier 1 and all of Tier 3 are tech-only. They stop being the backbone and become one vertical's feed. See §3.
- **ATS boards get promoted.** A company's Greenhouse/Lever board lists *every* open role — marketing, sales, finance, support, design, ops — not just engineering. Profession-agnostic by construction, which makes Tier 2 the structural backbone rather than a depth play.
- **Data model.** `stack[]` becomes `skills[]`, plus an explicit occupation taxonomy. See §5.
- **Matching leans semantic.** Tech tags are standardized (`react`, `typescript`) so overlap scoring works well. Outside tech, skills are mushy prose ("stakeholder management", "atendimento ao cliente") and tag overlap degrades badly. Weight shifts toward vector similarity — which raises the stakes on the embedding choice in §9.
- **Multi-language stops being an edge case.** Non-tech remote postings are far more often written in the local language. Moves from a footnote to a real requirement.
- **Volume and cost go up** substantially. The deterministic rules pre-filter in §4 carries more load, and a broad index makes the personalized feed *more* necessary, not less — which reinforces D6.

What this does **not** change: **the core differentiator is untouched.** Geographic eligibility is a property of the posting, not the profession. "US only", "worldwide", "LATAM", "EOR", "contractor" mean exactly the same thing for a designer as for a backend engineer. The classifier, the evidence requirement and the eligibility schema all carry over unmodified.

**Honest caveat on launch strategy:** "a job board for everyone" is much harder to launch than a niche one — there is no community to seed it in and no obvious first audience. The reconciliation: build the *architecture* profession-agnostic from day one (nothing hardcodes engineering anywhere), but let the *index* grow vertical by vertical as we add sources that cover them. Launch focused, scale broad. Nothing in this plan needs rework to support that.

### D10 — Design system from Claude Design, one component each

The visual design is authored in **Claude Design**, not in this repo.

| | |
|---|---|
| Project | `Jobsearch feed design` |
| URL | https://claude.ai/design/p/9dcb1900-074e-47ea-b840-522983e2b202 |
| Design system | `industry-0c021b97-e4e0-4037-a20b-2a135fcc7d67` ("Industry") |
| Screens | `Feed.dc.html`, `Profile.dc.html`, `Login.dc.html` |
| Imported | 2026-08-25 |

**Industry** is a wireframe system: steel-blue on a light technical ground,
Barlow Condensed over Barlow, and cards/figures/primary buttons drawn as
blueprint objects — square-cornered, hairline-bordered, with `+` registration
marks. Its full contract lives in `packages/design-system/README.md`.

Three rules, in force:

1. **The design system is vendored, never edited.** `packages/design-system`
   holds `styles.css` byte-identical to the design project's output, so a
   re-sync is a diff and not a merge. Modifiers the app needs but the system
   does not ship live in `packages/ui/src/styles/extensions.css`, built only
   from tokens.
2. **The `.dc.html` screens are prototypes, not source.** They run on the
   Claude Design canvas runtime (`x-dc`, `sc-for`, `sc-if`, `DCLogic` in
   `support.js`) — a preview interpreter that is deliberately not ported. The
   screens are read as design intent and re-expressed as React.
3. **Every component is written exactly once**, in `@jobsearch/ui`. Screens
   compose; they do not re-implement. See `docs/FRONTEND.md` for the inventory
   and the rule for adding a component.

Point 3 is the one that needed real work. A design canvas necessarily repeats
itself — each screen is a standalone document, so the same chip row is
hand-written seven times and the blueprint frame fourteen. Porting that
verbatim would carry the duplication into the codebase permanently. The
inventory in `docs/FRONTEND.md` records what collapsed into what.

### D11 — Locale-prefixed routes

Interface languages at launch: **English, Português (BR), Español** — chosen
because the first users are in Brazil and LATAM, per D9's launch reasoning.

The URL carries the locale: `/en/feed`, `/pt-br/feed`, `/es/feed`, with
`localePrefix: 'always'` so the default locale is prefixed too and one URL never
serves two languages.

**Why the prefix rather than a cookie.** PLAN.md names SEO-indexable job pages
as a growth channel (D6). A cookie-driven locale means one URL serving three
languages, so a crawler indexes only one of them and `hreflang` has nothing to
point at. It also means a shared link opens in the *recipient's* language, not
the sender's. The cost is a routing restructure, which is far cheaper now than
after job pages exist.

**Changing language navigates.** With the URL as the source of truth, setting a
preference without moving would leave the address bar lying about what is on
screen. The switcher lives on the landing page and in Profile → Account.

`profiles.interfaceLanguage` is kept as the *durable* preference — what the API
uses to pick a locale for a signed-in user arriving without a prefix, which a
cookie cannot do across devices. It does not drive the current page.

Authenticated screens (`/feed`, `/profile`) are `noindex` and carry no
`hreflang`: a personalised feed is not a page anyone should reach from search.

**Operational note:** `NEXT_PUBLIC_SITE_URL` must be set at **build** time. The
landing pages are prerendered and `hreflang`/`canonical` are absolute URLs baked
in at that point; without it they are emitted against `localhost` and ignored.

---

## 3. Sources

"Search the whole web" is not buildable and is not needed. Four tiers:

Per D9, coverage must span professions. Each source below is tagged with the professions it actually covers — that tagging is the thing that tells us where the index is thin.

### Tier 1 — ATS public endpoints ⭐ the backbone
*Coverage: all professions.*

Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters all expose public JSON per company board
(e.g. `boards-api.greenhouse.io/v1/boards/{company}/jobs`).

Promoted to Tier 1 by D9: a company board lists every open role, so one integration yields engineering, design, marketing, sales, support, finance and ops at once. Fresh, canonical, structured, links never rot, no scraping. Curate a company list (companies known to hire remote/LATAM/worldwide) and poll their boards directly.

This is the only tier that is profession-agnostic by construction, which makes it the structural answer to "how do we cover occupations we have no niche board for".

### Tier 2 — Cross-profession remote aggregators
*Coverage: broad, varies by source.*

- **Remotive** — has non-dev categories (marketing, support, design, finance, product)
- **Working Nomads**, **Jobspresso**, **Remote.co**, **JustRemote**, **Pangian**, **Jobicy** — general remote boards, mixed quality, need per-source region parsing
- **Arbeitnow** — `https://www.arbeitnow.com/api/job-board-api`, mostly EU-local; only useful when explicitly international-remote

To be validated individually: API/RSS availability, region metadata quality, licensing/ToS. Not all will survive.

### Tier 3 — Vertical sources
*Coverage: one profession each.*

- **Tech** — RemoteOK (`https://remoteok.com/api`, `location` field), We Work Remotely (category RSS, region per item), Himalayas (`https://himalayas.app/jobs/api`, per-job country restrictions), Hacker News "Who is hiring?" (Algolia API, monthly; one comment = one job; ignore "SEEKING WORK")
- **Design** — Dribbble, Behance job boards
- **Support / CX** — SupportDriven and similar community boards
- **Marketing, finance, ops, healthcare, education, legal** — ⬜ not yet researched

Each vertical is added as a source adapter. The tech verticals are what we have today; the rest are open work.

### Tier 4 — Curated leads (not verified jobs)
*Coverage: tech only today.*

Strider, Revelo, Lemon.io, Proxify, Arc.dev, Braintrust, Gun.io, Toptal, Terminal, X-Team, Turing, Ubiminds.
Surfaced as *leads*, clearly labelled, never mixed into the verified tier. Non-tech equivalents (staffing/EOR marketplaces for design, marketing, support) are open work.

### Explicitly out of scope
- **LinkedIn / Indeed scraping** — violates ToS and their anti-bot will win. Indeed only via the official connector if we use it at all; LinkedIn only as an outbound "explore more" link.

---

## 4. Pipeline

Four stages, each **idempotent and independently replayable**. This is the most important structural constraint in the system.

```
  fetch          →  raw_postings      immutable, JSONB, (source, external_id, fetched_at)
    ↓ normalize
  jobs           →  canonical: company, title, url, description, tags, posted_at, content_hash
    ↓ classify       rules pass first, LLM only for the ambiguous remainder
  job_eligibility → verdict, eligible_countries[], contract_types[], evidence_snippet, classifier_version
    ↓ match
  matches        →  (user_id, job_id, score, reasons)
```

**Why replayable matters:** the eligibility prompt will be improved constantly. Re-running `classify` over already-stored raw data costs nothing but LLM tokens — no re-crawling, no rate limits, no lost history. `classifier_version` on every row identifies what needs reprocessing. Same for `normalize` when a source changes its schema.

**Queue as a process boundary:** workers pull from the queue and write to the DB. No worker calls another worker directly. This is what makes the future Go rewrite of the fetcher a drop-in (see D2).

### Two-stage classification (cost control)
1. **Deterministic rules pass** — the accept/discard keyword lists from `claude_job.md`. Regex rejects "US only / must be authorized to work in the US / W2 / must reside in / hybrid / within X miles of"; auto-accepts "worldwide / anywhere in the world / LATAM / Latin America / Americas / Brazil / global remote". Free.
2. **LLM pass** — runs only on the genuinely ambiguous middle (postings that just say "Remote"), expected ~20–30% of volume. This is the difference between viable and unviable unit economics.

**Profession-independence (D9):** the classify stage does two things — eligibility *and* `job_family` assignment. The eligibility half is entirely profession-agnostic and needs no per-vertical work; the keyword lists below apply unchanged to any posting. Only job-family assignment is taxonomy-dependent.

### Evidence is a first-class column
The origin prompt requires citing the snippet that proves eligibility. That becomes `evidence_snippet` + `evidence_url` on `job_eligibility`. It is what makes ✅ CONFIRMED vs ⚠️ NEEDS CHECK auditable rather than a model's vibes — and it is the feature users will actually trust.

### Link health
A periodic `link_check` worker writes `last_verified_at` and `http_status`. Jobs older than ~60 days expire out of feeds. Directly from the origin prompt's "no broken links" rule.

---

## 5. Data model (sketch)

Not final — a shape, to be settled when we write the Prisma schema.

- `sources` — id, kind (api/rss/ats/hn), config, poll interval, health
- `companies` — name, domain, ats_type, careers_url, known_hiring_regions
- `raw_postings` — source_id, external_id, payload JSONB, fetched_at, content_hash *(immutable)*
- `jobs` — company_id, title, description, apply_url (canonical), job_family, skills[], seniority, language, posted_at, salary_min/max/currency, tsv (tsvector), embedding (vector), last_verified_at, http_status, expires_at
- `job_eligibility` — job_id, verdict (`confirmed` | `needs_check` | `rejected`), eligible_countries[], eligible_regions[], contract_types[], timezone_requirement, evidence_snippet, evidence_url, classifier_version, classified_at
- `users` — auth fields, email preferences, digest cadence/timezone
- `profiles` — residence_country, work_authorizations[], target_regions[], job_families[], roles[], skills[], seniority, contract_types[], min_comp + currency, languages[], timezone, embedding (vector)
- `job_families` — occupation taxonomy (see below): id, label, parent_id, aliases[]
- `matches` — user_id, job_id, score, reasons JSONB, created_at
- `job_events` — user_id, job_id, type (`seen` | `saved` | `dismissed` | `applied`), created_at
- `digests` — user_id, sent_at, job_ids[], opened_at

**Dedup key:** unique index on `content_hash`, plus normalized `(company, title, canonical_url)`. The same posting arrives from RemoteOK, WWR and the company's own Greenhouse board — it must appear once.

**Occupation taxonomy (new, per D9):** `stack[]` was engineer-specific; the generic form is `skills[]` plus a `job_family` classification (e.g. Engineering → Backend; Marketing → Growth; Finance → Accounting). Without a taxonomy, free-text titles across professions and languages are unmatchable. Candidates: **ESCO** (EU, ~3k occupations, multilingual, openly licensed — best fit given the multi-language requirement), **O\*NET** (US, richer skill data, English-only), or a lightweight homegrown list seeded from observed titles. Undecided — see §9. Job family is assigned during `classify`, alongside eligibility.

**Generalized from the origin prompt:** the profile is no longer hardcoded Brazil→US/EU, nor to engineering. Eligibility is `job.eligible_countries ∩ user.residence_country`; relevance is `job_family` + skills + vector similarity.
**Timezone is a preference, never a filter** — an EST/CET overlap requirement is acceptable; only residence or work-authorization requirements are blocking. The origin prompt gets this right and most boards get it wrong.

---

## 6. Monorepo layout

```
apps/
  web            ✅ Next.js (App Router) — SSR/SEO, BFF only, NEVER imports the DB
  api            ⬜ NestJS — owns ALL business logic and DB access
  worker         ⬜ queue consumers: fetch / normalize / classify / verify / digest
packages/
  design-system  ✅ "Industry" vendored from Claude Design — do not hand-edit
  ui             ✅ React component library — every component, written once
  shared         ✅ Zod schemas + inferred types      (shared with web)
  db             ⬜ Prisma schema + migrations        (api + worker only)
  core           ⬜ pure domain logic: eligibility rules, scoring, dedup
  sources        ⬜ one adapter per source, uniform interface
```

✅ built · ⬜ planned

`packages/core` stays pure and framework-free so the eligibility rules are unit-testable in isolation. We maintain a **fixture corpus** of real postings with expected verdicts and treat it as a regression suite — that logic *is* the product, and a prompt change that improves one case while breaking three must be visible.

### Boundary rules (CI-enforced)
- `apps/web` → may import `@jobsearch/shared`, `@jobsearch/ui`, `@jobsearch/design-system`.
  **Not** `@jobsearch/db`, **not** `@jobsearch/core`.
- `apps/api`, `apps/worker` → may import `db`, `core`, `shared`, `sources`.
- `packages/core` → no framework, no I/O, no Prisma client. Pure functions over plain types.
- `packages/ui` → no `next` import; the router's link component is injected via
  the `linkComponent` prop, so the library stays framework-agnostic.

Enforced by `pnpm boundaries` (dependency-cruiser, `.dependency-cruiser.cjs`),
not by convention. The `web-must-not-touch-db` rule has been verified to fail
the build on a real violation — a boundary nobody has watched fail is not a
boundary.

Within `apps/web`, `src/server/api-client.ts` is the single data entry point.
It is marked `server-only`, validates every response against the shared Zod
schemas at the boundary, and currently resolves fixtures because `apps/api`
does not exist yet. Swapping to the live API changes that one file.

---

## 7. Cross-cutting

**Auth** — single source of truth in the API. Web holds a session and forwards it; the API is the only thing that validates and authorizes. No second auth implementation in `middleware.ts` beyond redirecting unauthenticated users.

**Email** — transactional provider (Resend/Postmark). Digest is a scheduled worker job, per-user timezone. Must have one-click unsubscribe and a cadence setting.

**Observability** — structured logs, per-source fetch success rate, classification cost per day, LLM verdict distribution, link-rot rate. Source health is the metric that tells us the index is quietly rotting.

**Deployment** — boring on purpose. Managed Postgres (Neon/Supabase), API + worker on Fly.io/Railway/Render, web on Vercel or alongside.

**Legal/ToS** — respect `robots.txt`, identify our user-agent, rate-limit per host, honor source ToS. No LinkedIn/Indeed scraping (§3).

---

## 8. Milestones

- **M0 — Skeleton.** 🟡 *in progress.* Monorepo, pnpm/Turborepo, boundary check in
  CI, design system imported, component library and all three screens built
  against fixtures. Remaining: Prisma schema, Postgres up.
- **M1 — Ingestion.** Tier 1 sources + `raw_postings` → `jobs`, dedup, link check. Verified by row counts, no UI.
- **M2 — Classification.** Rules pass + LLM pass, evidence stored, fixture corpus as regression suite.
- **M3 — Accounts + feed.** Auth, profile, matching query, web feed with SSR job pages.
- **M4 — Digest.** Scheduled email, cadence + timezone + unsubscribe.
- **M5 — ATS depth + profession breadth.** Tier 1 company boards at scale — simultaneously where the index beats the aggregators *and* where non-tech coverage arrives, since one board yields every profession at a company.

Ordering rationale: the index must be good before the feed matters, and the feed must exist before the digest has anything to send. M5 sits after M4 because it is a scale-up of a pipeline that must already be proven.

Note on D9 vs. sequencing: the *schema and pipeline* are profession-agnostic from M0 — nothing hardcodes engineering. The *index* starts tech-heavy simply because those are the sources we have adapters for, and broadens through M5. If proving breadth early matters more than proving the loop, M5 moves ahead of M4.

---

## 9. Open questions

- [ ] Match scoring: weighting between vector similarity, stack overlap, seniority, salary, freshness. Needs tuning against real data — cannot be decided upfront.
- [ ] Cold start: how does a brand-new user get a decent feed before we have any interaction signal from them?
- [ ] Company curation for Tier 2 — how do we build and maintain the ATS company list? Manual seed, then grown from jobs discovered via Tier 1?
- [ ] Embedding model + dimensions (affects the pgvector column type; changing it later means a re-embed of everything).
- [ ] Auth provider — the Login screen is built but wired to nothing. Decides whether sessions live in the API only (per D5) or need a Next middleware component.
- [ ] The occupation taxonomy currently ships as a hardcoded list in `packages/shared/src/taxonomy.ts`. It must become fetched and versioned once the taxonomy question above is settled.
- [ ] Do we keep D8 (pg-boss) or move to Redis + BullMQ once we need Redis for rate-limit buckets anyway?
- [ ] **Occupation taxonomy: ESCO vs O\*NET vs homegrown?** Blocks the schema — `job_family` is a foreign key. ESCO leads on multilingual + licensing.
- [ ] **Multi-language postings** (PT/ES/DE/FR) — classify in the original language or translate first? Promoted from a footnote by D9; affects the embedding choice, since a multilingual model would let one vector space serve all languages.
- [ ] **Which professions do we launch with**, and what is the source-coverage bar before a vertical is publicly listed? Showing a profession with 4 stale jobs is worse than not showing it.
- [ ] **Country names are not localised.** The residence pickers list `Brazil`,
  `Argentina`, … in English in every locale, because `profiles.residenceCountry`
  stores a display name rather than a code. The fix is ISO 3166-1 alpha-2 codes
  in the schema plus `Intl.DisplayNames` for rendering — which localises every
  country for free and is what `job_eligibility.eligibleCountries` already
  assumes. A data-model change, not a translation one.
- [ ] Tier 2 aggregator validation — which of Remotive / Working Nomads / Jobspresso / Remote.co / JustRemote / Pangian / Jobicy actually expose usable APIs with region metadata and permissive ToS?
