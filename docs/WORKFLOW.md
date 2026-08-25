# Workflow

How changes get made in this repo, and why the rules are shaped this way.

The machine-readable version for AI agents is [`CLAUDE.md`](../CLAUDE.md).
This document is the reasoning behind it.

---

## The goal

**Every change must be reviewable by one person in one sitting.**

That single constraint produces every rule below. A 1,200-line PR does not get
reviewed — it gets skimmed and approved, which is worse than not reviewing it,
because it carries the appearance of scrutiny without the substance. Review
quality falls off a cliff somewhere around 400 changed lines, and by 800 it is
effectively rubber-stamping.

This matters more than usual here because much of the code is written by AI
agents, which can produce a very large, very plausible diff very quickly. The
bottleneck is not generation — it is your ability to read what was generated.
The rules exist to keep the diff inside human reading capacity.

---

## Four layers of enforcement

A rule in a document is a suggestion. These are the layers that actually stop
things, weakest to strongest:

| Layer | Enforces | Bypassable? |
|---|---|---|
| `CLAUDE.md` | Agent behaviour | Yes — it is a prompt |
| Git hooks (`.githooks/`) | No commits on main, commit format, no secrets | `--no-verify` |
| GitHub Actions (`.github/workflows/ci.yml`) | Gates, PR size, PR title | No, if branch protection is on |
| Branch protection (GitHub setting) | No direct pushes to main | Only by an admin |

**Branch protection is not enabled yet** — see [Setup](#setup) below. Until it
is, the hooks are the real floor, and they only apply on machines that have run
`pnpm install`.

---

## Worktrees

**Every unit of work happens in its own git worktree.** The primary checkout at
`~/Dev/jobsearch` stays on `main` and stays clean — it is the reference copy.

```bash
./scripts/worktree.sh new feat/api-eligibility-classifier
```

That creates `~/Dev/jobsearch-worktrees/feat-api-eligibility-classifier`,
branched from a freshly fetched `origin/main`, runs `pnpm install`, and assigns
a stable free port.

### Why worktrees rather than branch switching

- **Parallel work without stashing.** Review a PR while a feature branch keeps
  its state, dependencies and running dev server untouched.
- **No half-switched state.** `git checkout` across branches with different
  dependencies leaves `node_modules` mismatched with `package.json`, producing
  errors that look like code bugs. Separate directories cannot desynchronise.
- **Agents can work in parallel** without racing on the same working tree.
- **The primary checkout is always a known-good reference** you can diff
  against when something looks wrong.

### Two things that bite

**Dependencies are not shared.** Each worktree needs its own `pnpm install`.
The script does it for you.

**Dev servers collide on port 3000.** The script writes a per-branch `PORT` to
`.env.local`, so two worktrees never fight. This is why `apps/web`'s `dev`
script reads `${PORT:-3000}`.

### Cleaning up

```bash
./scripts/worktree.sh done feat/api-eligibility-classifier
```

Refuses to run if there are uncommitted or unpushed changes, then deletes the
branch if it has been merged.

---

## One branch, one functionality

A branch delivers exactly one reviewable capability.

The failure mode this prevents: a PR titled "add classifier" that also renames
three files, upgrades a dependency and reformats a module. The reviewer cannot
separate the change that matters from the noise, so they read none of it
carefully.

**When you find something else mid-task:**

| Situation | Do |
|---|---|
| It blocks your work | Fix it minimally, call it out in the PR description |
| It does not block your work | Leave it. Open a follow-up issue or branch |
| It is a big refactor | Always its own PR, never bundled |

### Splitting a feature

Split by **vertical slice**, not by layer. Each PR should leave `main` working.

Taking the eligibility classifier as an example — good:

```
1. feat(shared): eligibility verdict + evidence schema
2. feat(core): deterministic keyword pre-filter
3. test(core): fixture corpus of real postings
4. feat(core): LLM classifier for the ambiguous remainder
5. feat(api): expose classification endpoint
```

Each is independently reviewable and independently correct. Bad:

```
1. all the types
2. all the logic
3. all the tests
```

Nothing is reviewable until #3, and #1 and #2 are both dead code when merged.

### Stacked PRs

**Stack only when you have to.** The test is mechanical: can B compile, run and
be reviewed without A? If yes, open both against `main` in parallel. "B is
about A" is not a dependency.

Stacking has a cost. It couples two reviews, and it puts a tempting *Merge* button
in front of you that merges the child into the parent rather than into `main`.

When B genuinely needs unmerged A, branch B from A and open B's PR **with A's
branch as its base**. GitHub then shows only B's own diff. Say so in the
description.

**To land a stack: merge the parent into `main` first.** GitHub retargets the
child at `main` automatically, and its diff shrinks to just its own changes.

### Never merge one PR into another

This repo's first two PRs learned it the hard way. A 367-line tooling PR and a
474-line docs PR were stacked — unnecessarily, since documentation describing a
script does not depend on that script. The docs PR was then merged into the
tooling PR, which inherited its diff, hit 842 lines, and failed the size check
with a message about splitting that had nothing to do with the real cause.

CI now catches this directly: it looks for GitHub's `(#N)` squash-merge stamp
in the branch's commits and fails naming the offending PR. The remedy is always
the same — drop the merged commit, and re-target the other PR at `main`.

---

## Size budget

Measured as added + removed lines, excluding `pnpm-lock.yaml`, snapshots, and
the vendored design-system stylesheet.

| Lines | Meaning |
|---|---|
| ≤ 200 | Ideal. Reviewable properly in a few minutes |
| ≤ 400 | Fine |
| 400–800 | CI warns. Justify it in the description |
| > 800 | **CI fails.** Split it |

The genuine exception is a large *mechanical* change — a codemod, a generated
migration, a dependency bump touching many files. Label the PR
`large-mechanical` and CI waives the limit. Use it honestly: "mechanical" means
a reviewer can verify it by checking the *pattern* rather than every line.

---

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by the
`commit-msg` hook and on PR titles by CI.

```
<type>(<scope>): <imperative summary>
```

`type` — `feat` `fix` `refactor` `docs` `test` `chore` `ci` `build` `perf` `style`
`scope` — `web` `ui` `shared` `api` `worker` `db` `core` `sources` `design-system` `repo`

**The commit sequence is part of the review.** Do not squash a branch into one
commit — the steps are how a reviewer follows your reasoning. Equally, do not
commit "wip" and "fixes"; rebase them into coherent steps before pushing.

Once a PR has review comments, **stop rewriting its history.** Amending or
rebasing destroys the reviewer's place and their sense of what changed since
they last looked. Push follow-up commits instead; squash on merge if you want a
clean `main`.

---

## The gates

Before opening a PR:

```bash
pnpm typecheck && pnpm boundaries && pnpm build
```

`pnpm boundaries` is the one people forget. It enforces the architectural
decisions in `PLAN.md` — most importantly **D5**, that `apps/web` never touches
the database. That rule decays the instant it is only a convention, because the
violating path is always shorter to write. See `.dependency-cruiser.cjs`.

---

## Review

The PR author's job is to make review *easy*:

- **Say what the PR does not do.** Scope boundaries prevent "why didn't you
  also…" review cycles.
- **Point at where to start.** "The logic is in commit 3; the rest is wiring."
- **Screenshots for any `apps/web` change.** Before/after when modifying
  existing UI. A design regression is invisible in a diff — the `Stack` gap bug
  that shipped 20.4px where the design wanted 6px typechecked perfectly.

**Nobody merges their own PR, and agents never merge at all.** The point of the
PR is that a human reads it.

---

## Setup

Hooks install automatically via `pnpm install` (the root `prepare` script). To
do it manually:

```bash
git config core.hooksPath .githooks
```

### Enabling branch protection

Not yet enabled — it is a change to the GitHub repository settings and worth
making deliberately, since it also stops *you* pushing to `main`:

```bash
gh api -X PUT repos/allbdev/jobsearch/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -F 'required_status_checks[contexts][]=Gates' \
  -F 'required_status_checks[contexts][]=Reviewability' \
  -F 'enforce_admins=false' \
  -F 'required_pull_request_reviews[required_approving_review_count]=0' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

`enforce_admins=false` lets you bypass in a genuine emergency;
`required_approving_review_count=0` means you can merge your own PRs without a
second reviewer, which matters on a solo project — the PR still forces the diff
in front of you before it lands.

Also worth setting in **Settings → General → Pull Requests**: enable *Allow
squash merging*, disable merge commits, and enable *Automatically delete head
branches*.

---

## Emergencies

If production is broken and the process is in the way:

1. `git commit --no-verify` bypasses the hooks.
2. Fix it.
3. **Open the PR afterwards anyway**, describing what was bypassed and why.

The process exists to keep the code reviewable, not to keep the site down.
