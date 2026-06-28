#!/usr/bin/env bash
# Orchestrateur d'intégration — SCAN READ-ONLY.
# Détecte tous les candidats (worktrees + branches locales + branches remote/PRs)
# et calcule pour chacun: ahead/behind vs origin/main, dirty, mergeable (merge à blanc),
# fichiers single-owner touchés. N'effectue AUCUNE écriture git.
set -uo pipefail
REPO="/Users/adrienbeyondcrypto/Dev/Hearst Corporation/connect — Hearst Defi"
cd "$REPO" || exit 2

# Fichiers single-owner (depuis CLAUDE.md) — collision = STOP
SINGLE_OWNER="prisma/schema.prisma package.json pnpm-lock.yaml next.config.ts next.config.js tailwind.config.ts src/app/api/cockpit-chat/route.ts src/lib/llm/tools/registry.ts src/lib/canvas/compose.ts src/lib/canvas/emit.ts src/app/globals.css src/app/doc-flow.css src/app/admin/admin-proof.css docs/agent-file-locks.md CLAUDE.md .mcp.json"
FORBIDDEN_RE='(^|/)\.env|\.env\.|\.local$|node_modules/|/screenshots/|/tmp/|/logs/|/coverage/|playwright-report/|\.DS_Store'

git fetch --all --prune >/dev/null 2>&1
MAIN=$(git rev-parse origin/main)
echo "## SCAN $(git rev-parse --short origin/main) origin/main"
echo "MAIN=$MAIN"

# helper: classe une branche par son contenu vs origin/main
classify () {
  local ref="$1" label="$2"
  # exists?
  git rev-parse --verify -q "$ref" >/dev/null 2>&1 || { echo "  [$label] $ref :: GONE"; return; }
  local tip; tip=$(git rev-parse "$ref")
  if [ "$tip" = "$MAIN" ]; then echo "  [$label] $ref :: AT_MAIN (rien à faire)"; return; fi
  # fully merged?
  if git merge-base --is-ancestor "$ref" "$MAIN" 2>/dev/null; then echo "  [$label] $ref :: MERGED (tip ⊂ main)"; return; fi
  local ahead behind; ahead=$(git rev-list --count "$MAIN".."$ref" 2>/dev/null); behind=$(git rev-list --count "$ref".."$MAIN" 2>/dev/null)
  # any unique work? (3-dot diff)
  local nfiles; nfiles=$(git diff --name-only "$MAIN...$ref" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$nfiles" -eq 0 ]; then echo "  [$label] $ref :: NO_UNIQUE_WORK (ahead=$ahead behind=$behind, contenu déjà sur main)"; return; fi
  # forbidden files?
  local fb; fb=$(git diff --name-only "$MAIN...$ref" 2>/dev/null | grep -E "$FORBIDDEN_RE" | head -3)
  # single-owner touched?
  local changed; changed=$(git diff --name-only "$MAIN...$ref" 2>/dev/null)
  local so=""
  for f in $SINGLE_OWNER; do echo "$changed" | grep -qxF "$f" && so="$so $f"; done
  # mergeable? (merge-tree à blanc, read-only, git >= 2.38)
  local mt; mt=$(git merge-tree --write-tree "$MAIN" "$ref" 2>/dev/null)
  local conflict="no"
  if echo "$mt" | grep -q "^CONFLICT\|<<<<<<<"; then conflict="YES"; fi
  # merge-tree --write-tree renvoie 0 si OK, !=0 si conflit
  git merge-tree --write-tree "$MAIN" "$ref" >/dev/null 2>&1 || conflict="YES"
  echo "  [$label] $ref :: UNIQUE_WORK ahead=$ahead behind=$behind files=$nfiles conflict=$conflict single_owner=[${so# }] forbidden=[$(echo $fb|tr '\n' ' ')]"
}

echo "### WORKTREES"
git worktree list --porcelain | awk '/^worktree /{wt=$2} /^branch /{print wt" "$2}' | while read -r path ref; do
  [ "$ref" = "refs/heads/main" ] && continue
  exists="ON_DISK"; [ -d "$path" ] || exists="DISK_MISSING(prune?)"
  br=${ref#refs/heads/}
  dirty="clean"
  if [ -d "$path" ]; then n=$(git -C "$path" status --porcelain 2>/dev/null | wc -l | tr -d ' '); [ "$n" -gt 0 ] && dirty="DIRTY($n)"; fi
  echo "- WT $path [$br] $exists $dirty"
  classify "$br" "wt:$br"
done

echo "### BRANCHES LOCALES (sans worktree)"
WT_BRANCHES=$(git worktree list --porcelain | awk '/^branch /{print $2}' | sed 's#refs/heads/##')
git for-each-ref --format='%(refname:short)' refs/heads | while read -r br; do
  [ "$br" = "main" ] && continue
  echo "$WT_BRANCHES" | grep -qxF "$br" && continue   # déjà couvert en worktree
  classify "$br" "local:$br"
done

echo "### BRANCHES REMOTE (origin, hors main)"
git for-each-ref --format='%(refname:short)' refs/remotes/origin | while read -r br; do
  case "$br" in origin/main|origin/HEAD) continue;; esac
  classify "$br" "remote:$br"
done

echo "### PRs OUVERTES"
gh pr list --state open --json number,title,headRefName,isDraft,mergeStateStatus 2>/dev/null \
 | node -e 'const d=JSON.parse(require("fs").readFileSync(0));for(const p of d)console.log(`  PR#${p.number} ${p.isDraft?"[DRAFT]":""} ${p.mergeStateStatus} ${p.headRefName} — ${p.title}`)' 2>/dev/null || echo "  (gh indispo)"

echo "## END SCAN"
