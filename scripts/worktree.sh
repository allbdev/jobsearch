#!/usr/bin/env bash
#
# Worktree lifecycle helper.
#
# Every unit of work in this repo happens in its own git worktree, so the
# primary checkout stays clean on main and several tasks can run in parallel
# without stepping on each other. See CLAUDE.md §1.2 and docs/WORKFLOW.md.
#
#   ./scripts/worktree.sh new  feat/ui-job-card   [base-branch]
#   ./scripts/worktree.sh list
#   ./scripts/worktree.sh done feat/ui-job-card
#
set -euo pipefail

# --show-toplevel would give the *current* worktree, so running this from
# inside one would nest worktrees inside each other. --git-common-dir always
# points at the primary checkout's .git, from either place.
GIT_COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
REPO_ROOT="$(dirname "$GIT_COMMON_DIR")"

# Worktrees live inside the project, under a gitignored directory. Because
# REPO_ROOT always resolves to the primary checkout (via --git-common-dir),
# this path is the same whether the script runs from the primary checkout or
# from inside a worktree -- worktrees never nest inside each other.
WORKTREE_HOME="$REPO_ROOT/.claude/worktrees"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }

slug() { printf '%s' "$1" | tr '/' '-'; }

# A stable port per branch, so two worktrees never fight over 3000.
pick_port() {
  local name="$1" hash port
  hash=$(printf '%s' "$name" | cksum | cut -d' ' -f1)
  port=$(( 3100 + (hash % 800) ))
  while lsof -ti:"$port" >/dev/null 2>&1; do port=$(( port + 1 )); done
  printf '%s' "$port"
}

validate_branch() {
  local branch="$1"
  [[ "$branch" =~ ^(feat|fix|refactor|docs|test|chore|ci|build)/[a-z0-9]+(-[a-z0-9]+)*$ ]] || die \
"invalid branch name: '$branch'

Expected: <type>/<scope>-<short-kebab-description>
  type  = feat | fix | refactor | docs | test | chore | ci | build
  scope = web | ui | shared | api | worker | db | core | sources | design-system | repo

Example: feat/api-eligibility-classifier"
}

# Copy the primary checkout's local env files into a new worktree.
#
# Env files are gitignored (CLAUDE.md 1.8), so a fresh worktree starts with
# none of them and every command that needs a credential fails -- or worse,
# silently falls back to a default. They live per package (apps/worker/.env,
# packages/db/.env), not just at the repo root, so this mirrors whatever the
# primary checkout has, at the same relative paths.
#
# `.env.example` files are tracked, so the worktree already has them; copying
# them would be a no-op at best and would clobber an example at worst.
copy_env_files() {
  local dir="$1" rel copied=0

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    mkdir -p "$dir/$(dirname "$rel")"
    cp "$REPO_ROOT/$rel" "$dir/$rel"
    printf '  %s\n' "$rel"
    copied=$((copied + 1))
  done < <(cd "$REPO_ROOT" && find . \
    \( -name node_modules -o -name .git -o -name .next -o -name dist -o -name .claude \) -prune -o \
    -type f \( -name '.env' -o -name '.env.*' \) \
    ! -name '*.example' ! -name '*.sample' \
    -print | sed 's|^\./||' | sort)

  if [ "$copied" = "0" ]; then
    info "no local env files in the primary checkout to copy"
  else
    ok "copied $copied env file(s) from the primary checkout"
  fi
}

# Assign this worktree's port without discarding whatever else .env.local
# holds -- it may have just been copied from the primary checkout, whose PORT
# belongs to a different worktree.
set_port() {
  local file="$1" port="$2"
  if [ -f "$file" ]; then
    grep -v '^[[:space:]]*PORT=' "$file" > "$file.tmp" || true
    mv "$file.tmp" "$file"
  fi
  printf 'PORT=%s\n' "$port" >> "$file"
}

cmd_new() {
  local branch="${1:-}" base="${2:-main}"
  [ -n "$branch" ] || die "usage: worktree.sh new <type>/<scope>-<description> [base-branch]"
  validate_branch "$branch"

  local dir="$WORKTREE_HOME/$(slug "$branch")"
  [ -e "$dir" ] && die "worktree already exists: $dir"

  info "Fetching origin..."
  git -C "$REPO_ROOT" fetch origin --quiet

  local start_point="origin/$base"
  git -C "$REPO_ROOT" rev-parse --verify --quiet "$start_point" >/dev/null \
    || start_point="$base"

  mkdir -p "$WORKTREE_HOME"
  info "Creating worktree from $start_point..."
  git -C "$REPO_ROOT" worktree add -b "$branch" "$dir" "$start_point"

  # node_modules are NOT shared between worktrees — each needs its own install.
  info "Installing dependencies (not shared between worktrees)..."
  (cd "$dir" && pnpm install --silent)

  copy_env_files "$dir"

  local port; port="$(pick_port "$branch")"
  set_port "$dir/.env.local" "$port"

  ok "worktree ready"
  cat <<EOF

  cd $dir
  PORT=$port pnpm --filter @jobsearch/web dev    # http://localhost:$port

  Before opening a PR:
    pnpm typecheck && pnpm boundaries && pnpm build

  When merged:
    ./scripts/worktree.sh done $branch

EOF
}

cmd_list() {
  printf 'Worktrees under %s\n\n' "$WORKTREE_HOME"
  git -C "$REPO_ROOT" worktree list
}

# Is this branch's pull request merged?
#
# `git branch --merged` cannot answer this: the repo squash-merges (merge
# commits are disabled and linear history is required), so a merged branch's
# commits never appear in main's ancestry. GitHub is the only source of truth,
# with the ancestry check kept as a fallback for when gh is unavailable.
branch_is_merged() {
  local branch="$1"
  if command -v gh >/dev/null 2>&1; then
    local merged
    merged=$(gh pr list --head "$branch" --state merged --json number --jq 'length' 2>/dev/null || echo "")
    if [ -n "$merged" ]; then
      [ "$merged" != "0" ]
      return
    fi
  fi
  git -C "$REPO_ROOT" branch --merged origin/main | grep -qx "  $branch"
}

# Resolve a worktree's path from its branch, via git's own registry. Deriving
# the path from the branch name breaks as soon as a branch is renamed after the
# worktree was created.
worktree_dir_for_branch() {
  git -C "$REPO_ROOT" worktree list --porcelain | awk -v want="refs/heads/$1" '
    /^worktree /  { dir = substr($0, 10) }
    /^branch /    { if (substr($0, 8) == want) { print dir; exit } }
  '
}

cmd_done() {
  local branch="${1:-}"
  [ -n "$branch" ] || die "usage: worktree.sh done <branch>"
  local dir; dir="$(worktree_dir_for_branch "$branch")"
  [ -n "$dir" ] || die "no worktree checked out for branch '$branch'
Run './scripts/worktree.sh list' to see what exists."
  [ -d "$dir" ] || die "worktree for '$branch' is registered at $dir but missing on disk.
Run 'git worktree prune' to clean up the stale entry."

  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    die "worktree has uncommitted changes — commit or discard them first:
  $dir"
  fi

  local unpushed
  unpushed=$(git -C "$dir" log --oneline "@{upstream}..HEAD" 2>/dev/null | wc -l | tr -d ' ') || unpushed=0
  [ "$unpushed" != "0" ] && die "$unpushed unpushed commit(s) on $branch — push them first"

  git -C "$REPO_ROOT" worktree remove "$dir"
  ok "removed worktree $dir"

  if branch_is_merged "$branch"; then
    # -D rather than -d: a squash merge leaves no ancestry, so git itself
    # cannot tell the branch is merged and -d would refuse.
    git -C "$REPO_ROOT" branch -D "$branch" >/dev/null
    ok "deleted merged branch $branch"
  else
    info "branch $branch kept (its pull request is not merged)"
  fi
}

cmd_prune() {
  info "Fetching origin..."
  git -C "$REPO_ROOT" fetch origin --quiet --prune

  local removed=0
  while read -r branch; do
    [ -z "$branch" ] && continue
    [ "$branch" = "main" ] && continue
    if branch_is_merged "$branch"; then
      local dir; dir="$(worktree_dir_for_branch "$branch")"
      if [ -n "$dir" ] && [ -d "$dir" ]; then
        if [ -n "$(git -C "$dir" status --porcelain)" ]; then
          info "skipped $branch -- worktree has uncommitted changes"
          continue
        fi
        git -C "$REPO_ROOT" worktree remove "$dir"
        ok "removed worktree $dir"
      fi
      git -C "$REPO_ROOT" branch -D "$branch" >/dev/null
      ok "deleted merged branch $branch"
      removed=$((removed + 1))
    fi
  done <<< "$(git -C "$REPO_ROOT" for-each-ref --format='%(refname:short)' refs/heads/)"

  [ "$removed" = "0" ] && info "nothing to prune" || ok "pruned $removed branch(es)"
}

case "${1:-}" in
  new)   shift; cmd_new "$@" ;;
  list)  shift; cmd_list "$@" ;;
  done)  shift; cmd_done "$@" ;;
  prune) shift; cmd_prune "$@" ;;
  *) die "usage: worktree.sh {new|list|done|prune} [args]

  new <branch> [base]   create an isolated worktree, install deps, assign a port
  list                  show all worktrees
  done <branch>         remove the worktree and clean up the branch
  prune                 remove every worktree and branch whose PR is merged" ;;
esac
