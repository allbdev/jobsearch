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

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_HOME="$(cd "$REPO_ROOT/.." && pwd)/jobsearch-worktrees"

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

  local port; port="$(pick_port "$branch")"
  printf 'PORT=%s\n' "$port" > "$dir/.env.local"

  # Carry over any local secrets the primary checkout has.
  if [ -f "$REPO_ROOT/.env" ]; then
    cp "$REPO_ROOT/.env" "$dir/.env"
    ok "copied .env from primary checkout"
  fi

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
  git -C "$REPO_ROOT" worktree list
}

cmd_done() {
  local branch="${1:-}"
  [ -n "$branch" ] || die "usage: worktree.sh done <branch>"
  local dir="$WORKTREE_HOME/$(slug "$branch")"
  [ -d "$dir" ] || die "no worktree at $dir"

  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    die "worktree has uncommitted changes — commit or discard them first:
  $dir"
  fi

  local unpushed
  unpushed=$(git -C "$dir" log --oneline "@{upstream}..HEAD" 2>/dev/null | wc -l | tr -d ' ') || unpushed=0
  [ "$unpushed" != "0" ] && die "$unpushed unpushed commit(s) on $branch — push them first"

  git -C "$REPO_ROOT" worktree remove "$dir"
  ok "removed worktree $dir"

  if git -C "$REPO_ROOT" branch --merged origin/main | grep -qx "  $branch"; then
    git -C "$REPO_ROOT" branch -d "$branch"
    ok "deleted merged branch $branch"
  else
    info "branch $branch kept (not merged into origin/main yet)"
  fi
}

case "${1:-}" in
  new)  shift; cmd_new "$@" ;;
  list) shift; cmd_list "$@" ;;
  done) shift; cmd_done "$@" ;;
  *) die "usage: worktree.sh {new|list|done} [args]

  new <branch> [base]   create an isolated worktree, install deps, assign a port
  list                  show all worktrees
  done <branch>         remove the worktree and clean up the branch" ;;
esac
