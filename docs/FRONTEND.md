# Frontend architecture

Companion to `PLAN.md` (see **D5** — Next as BFF — and **D10** — design system
and the one-component rule).

---

## 1. The rule

> **Every component is written exactly once, in `@jobsearch/ui`. Screens
> compose; they never re-implement.**

If a screen needs markup that another screen also needs, it does not get
copied — it becomes a component, or it grows a variant prop.

This needs stating because the design source *cannot* obey it. A Claude Design
canvas is a set of standalone documents: each `.dc.html` screen carries its own
copy of every pattern it uses, because there is nowhere shared to put them.
Porting those screens verbatim would import that duplication permanently.

## 2. Package layout

```
packages/design-system   "Industry", vendored from Claude Design — never hand-edited
packages/ui              React components — the only place a component is written
packages/shared          Zod schemas, domain types, taxonomy lists
apps/web                 Next.js — routes, data fetching, screen composition
```

**Where a thing goes**

| It is… | It lives in… |
|---|---|
| A token, or a DS component class | `packages/design-system` (re-synced, not authored) |
| Component styling | a co-located `Component.module.css` |
| A modifier the DS lacks but the design uses | `packages/ui/src/styles/extensions.css` |
| Any reusable markup | `packages/ui/src/primitives` or `.../components` |
| A domain type or option list | `packages/shared` |
| Route, data fetching, screen composition | `apps/web` |

`primitives/` wrap the design system's own classes and know nothing about jobs.
`components/` know about the domain (an eligibility badge, a job row) but
nothing about routing or data fetching.

## 3. What collapsed into what

The measurable result of the rule. Counts are hand-written occurrences in the
three design screens:

| Component | Written in the design | Written here | Callers |
|---|---:|---:|---|
| `Blueprint` (frame + 4 `+` marks) | 11× | 1 | every framed element |
| `ChipToggleGroup` | 7× | 1 | Feed dialog ×3, Profile ×4 |
| `SegmentedControl` | 5×, in 2 designs | 1 | Feed sort, Profile seniority/cadence/history tabs, Login mode |
| `AppShell` + `Brand` | 3× | 1 | all three screens |
| `EligibilityBadge` | 3× | 1 | Feed row, Profile history, Landing |
| `SectionCard` | 5× | 1 | Profile |
| `CompensationField` | 2× | 1 | Feed dialog, Profile |
| `EvidenceCard` | 2×, in 2 designs | 1 (+`variant`) | Feed row, Landing |

`SegmentedControl` is the clearest case. The design expresses it two ways — a
native radio `.seg` in three places, and a hand-rolled button `.seg` that
recomputes `background`/`color` inline in two more. One controlled component
covers all five.

`EvidenceCard` is the counter-example worth understanding: the two usages are
genuinely different — the feed's sits inside an already-framed panel (tinted
hairline box), the landing's stands alone (full blueprint frame with marks,
which the design system requires of standalone framed elements). That is a
`variant` prop, not a second component, and not one component forced to look
wrong in one of the two places.

## 4. Conventions

**Tokens only.** No raw hex, font name, or spacing value that a token already
carries. Reference them as CSS variables — `var(--color-accent)`,
`var(--space-3)` — from the component's `.module.css`.

There was briefly a typed accessor module (`@jobsearch/design-system/tokens`)
that wrapped these as TypeScript constants. It existed because styles lived in
inline `style` props, where a token reference is just a string and a typo
renders as `initial`. Once styling moved to CSS Modules it had no callers, so
it was deleted rather than kept as an unused abstraction. If JavaScript ever
genuinely needs a token value, read it from the computed style rather than
reintroducing a second source of truth.

**Spacing is unambiguous by type.** `gap="3"` is a scale step
(`var(--space-3)`); `gap={3}` is 3 pixels. An earlier build accepted a number
for both and silently turned the design's 6px feed-list gap into 20.4px — the
kind of bug that only shows up in a screenshot.

**Icons come from `@jobsearch/ui`**, not from `lucide-react` directly. The
library re-exports a blessed set and forces `strokeWidth={1.5}`, which the
design system requires and Lucide's default (2.0) violates.

**The library is framework-agnostic.** `packages/ui` may not import `next`;
CI enforces it. Screens inject the router's link via `linkComponent`.

**Polymorphism over near-duplicates.** `<Button as={Link}>` rather than a
separate `LinkButton`. Same for `Blueprint`, `Tag`, `Stack`, `Cluster`.

## 5. Data flow

```
RSC page.tsx  →  src/server/api-client.ts  →  [HTTP]  →  apps/api  →  Postgres
                        │
                        └── validates every response against @jobsearch/shared
```

`api-client.ts` is the **only** place the web app gets data. It is marked
`server-only`, so importing it from a client component is a build error. It
currently resolves fixtures (`src/server/fixtures.ts`) because `apps/api` does
not exist yet — but those fixtures are typed against the production schemas, so
the screens are already built against the real contract. When the API lands,
this one file changes.

Screens receive data as props and own only interaction state (expanded row,
saved/dismissed, dialog open, draft form values).

## 6. Adding a component

1. Does something similar exist? Add a **variant prop** instead.
2. Is it domain-aware? → `components/`. Purely presentational? → `primitives/`.
3. Build it from DS classes and tokens. If a modifier is missing, add it to
   `extensions.css` — never to `packages/design-system`.
4. Export it from `packages/ui/src/index.ts`.
5. `pnpm typecheck && pnpm boundaries`.

## 7. Verifying

```bash
pnpm typecheck     # all packages
pnpm boundaries    # architectural rules (dependency-cruiser)
pnpm --filter @jobsearch/web build
pnpm --filter @jobsearch/web dev     # http://localhost:3000
```

Routes: `/` (landing + auth), `/feed`, `/profile`.

## 8. Known gaps

- **No auth.** The Login screen is presentation only; its buttons link to
  `/feed`. Provider choice is an open question in `PLAN.md` §9.
- **No persistence.** Save/dismiss/apply and every form live in React state and
  reset on reload. They become API calls once `apps/api` exists.
- **Fixtures, not data.** Every posting is fabricated (see §5).
- **Not yet responsive.** Both app screens use fixed two-column grids, matching
  the design, which was drawn at desktop width only. No breakpoints exist yet.
- **No component tests.** The design-system contract test named in
  `packages/design-system/README.md` is not written yet.
