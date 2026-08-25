# CLAUDE.md — operating rules for AI agents in this repo

**Read this before touching anything.** These rules are not style preferences.
Violating them produces work that cannot be reviewed, which means it cannot be
merged. If a rule blocks you, stop and ask — do not route around it.

Human-facing rationale and the full how-to: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

---

## 1. Hard rules

These are absolute. There is no task urgent enough to justify breaking one.

### 1.1 Never commit or push to `main`

`main` is protected. Every change arrives through a pull request. You do not
commit to `main`, you do not push to `main`, you do not merge to `main` locally.

### 1.2 Never work in the primary checkout

`/Users/vinicius.albuquerque/Dev/jobsearch` is the reference checkout. It stays
on `main` and stays clean. **All work happens in a git worktree**, created
inside the project at `.claude/worktrees/<branch-slug>` (gitignored).

```bash
./scripts/worktree.sh new feat/api-eligibility-classifier
```

Before you edit a single file, confirm you are not in the primary checkout:

```bash
git rev-parse --show-toplevel   # must NOT be .../Dev/jobsearch
git branch --show-current       # must NOT be main
```

### 1.3 One branch = one functionality

A branch delivers exactly one reviewable capability. Not two. Not "and while I
was in there".

If, mid-task, you find a second thing that needs doing:
- **It blocks your work** → do the minimum, note it in the PR description.
- **It does not block your work** → leave it. Tell the user. Open a follow-up.

Never bundle a refactor with a feature. Never bundle a rename with a fix. The
reviewer cannot tell which change caused which effect.

### 1.4 Respect the size budget

Measured as changed lines in the PR diff, excluding lockfiles and generated
files.

| Lines | Status |
|---|---|
| ≤ 200 | Ideal |
| ≤ 400 | Acceptable |
| 400–800 | Needs justification in the PR description |
| > 800 | **CI fails. Split it.** |

If your change is heading past 400 lines, stop and split it *before* you finish
— splitting after the fact is far more work. A large mechanical change (a
codemod, a generated migration) is the one legitimate exception; say so
explicitly in the PR description and label it `large-mechanical`.

**Do not ask for an exception to the budget.** Split the work.

### 1.5 Every PR must pass the gates locally first

```bash
pnpm typecheck && pnpm boundaries && pnpm build
```

All three must pass before you open a PR. CI runs them again; a red CI on a PR
you opened means you skipped this step.

### 1.6 Never rewrite shared history

- No `git push --force` to any branch someone else may have pulled.
- `--force-with-lease` only, and only on your own un-reviewed branch.
- Once a PR has a review comment on it, **never** amend or rebase its commits —
  it destroys the reviewer's place. Push follow-up commits instead.

### 1.7 Never merge your own PR

Open it, report the URL, stop. The user merges. The point of the PR is that a
human reads it.

### 1.8 Never commit secrets or generated artifacts

No `.env`, no credentials, no API keys, no `node_modules`, no `.next`, no
`dist`. If a secret is needed, add the key name to `.env.example` with an empty
value and tell the user what to set.

### 1.9 Never hand-edit `packages/design-system`

It is vendored from Claude Design (PLAN.md **D10**). Changes there are
overwritten on the next sync. App-specific CSS goes in
`packages/ui/src/styles/extensions.css`.

---

## 2. The workflow

```bash
# 1. Create an isolated worktree (installs deps, assigns a free port)
./scripts/worktree.sh new feat/ui-job-card

# 2. Work there. Commit in logical steps.
git add -p
git commit -m "feat(ui): add JobCard with eligibility badge"

# 3. Gates
pnpm typecheck && pnpm boundaries && pnpm build

# 4. Push and open the PR
git push -u origin feat/ui-job-card
gh pr create --fill

# 5. Report the URL to the user. Do not merge.
```

When done and merged:

```bash
./scripts/worktree.sh done feat/ui-job-card   # this branch
./scripts/worktree.sh prune                   # every merged branch
```

Worktrees cost 400–600MB each. Prune after a batch of PRs lands.

### Branch naming

```
<type>/<scope>-<short-kebab-description>
```

`type` ∈ `feat` `fix` `refactor` `docs` `test` `chore` `ci` `build`
`scope` ∈ `web` `ui` `shared` `api` `worker` `db` `core` `sources` `design-system` `repo`

Examples: `feat/api-eligibility-classifier`, `fix/ui-segmented-control-a11y`,
`chore/repo-ci-pipeline`.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>): <imperative summary>`

Each commit should be a coherent step a reviewer can read on its own. Do not
commit "wip" or "fixes". Do not squash your whole branch into one commit — the
commit sequence is how the reviewer follows your reasoning.

```
feat(shared): add eligibility verdict schema with evidence requirement
feat(core): implement deterministic keyword pre-filter
feat(core): add LLM classifier for ambiguous postings
test(core): add fixture corpus for eligibility rules
```

### Stacked work

**Default to independent PRs.** Stack only when B literally cannot compile or
run without A. "B describes A" or "B is related to A" is *not* a dependency —
open both against `main` in parallel.

If B genuinely depends on unmerged A: branch B from A, open B's PR with A's
branch as its base, and say so in the description.

**Never merge one PR into another.** Not stacked ones, not related ones. It
pulls an already-reviewed diff into the other PR, blows its size budget, and CI
rejects it by name. To land a stack, merge the parent into `main` first —
GitHub retargets the child automatically.

---

## 3. Project facts

**Stack:** pnpm + Turborepo monorepo. Next.js 15 / React 19 (web), NestJS
(api, planned), PostgreSQL + Prisma (planned), TypeScript throughout.

**Commands:**

| | |
|---|---|
| `pnpm install` | Install (run once per worktree — deps are not shared) |
| `PORT=3xxx pnpm --filter @jobsearch/web dev` | Dev server |
| `pnpm typecheck` | All packages |
| `pnpm boundaries` | Architectural rules (dependency-cruiser) |
| `pnpm build` | All packages |

**Architecture rules that CI enforces** (`.dependency-cruiser.cjs`):
- `apps/web` must never import `@jobsearch/db` or `@jobsearch/core` — it is a
  BFF and talks to `apps/api` over HTTP (PLAN.md **D5**).
- `packages/ui` must never import `next` — the router link is injected.
- `packages/core` stays framework-free.

**Read before designing anything:**
- [`docs/PLAN.md`](docs/PLAN.md) — product, architecture, decision log (D1–D10)
- [`docs/FRONTEND.md`](docs/FRONTEND.md) — component library rules and inventory
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — this workflow, with rationale

**Decisions are recorded, not re-litigated.** If you think a decision in
`PLAN.md` is wrong, say so and explain why — do not silently implement
something different.

---

## 4. Reporting

When you finish a task, report:
1. What you did and what you deliberately left out.
2. The PR URL.
3. Gate results — actual output, not "should pass".

If tests fail, say so and show the output. Never report success you have not
verified.
