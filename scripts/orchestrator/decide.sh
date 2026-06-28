#!/usr/bin/env bash
# Orchestrateur d'intégration — MOTEUR DE DÉCISION (read-only).
# Pour chaque branche candidate, émet un verdict d'intégration.
# N'effectue AUCUNE écriture git. L'exécution du merge est faite par l'agent
# après lecture des verdicts MERGE.
set -uo pipefail
REPO="/Users/adrienbeyondcrypto/Dev/Hearst Corporation/connect — Hearst Defi"
cd "$REPO" || exit 2

SINGLE_OWNER="prisma/schema.prisma package.json pnpm-lock.yaml next.config.ts next.config.js tailwind.config.ts src/app/api/cockpit-chat/route.ts src/lib/llm/tools/registry.ts src/lib/canvas/compose.ts src/lib/canvas/emit.ts src/app/globals.css src/app/doc-flow.css src/app/admin/admin-proof.css docs/agent-file-locks.md CLAUDE.md .mcp.json"
FORBIDDEN_RE='(^|/)\.env|\.env\.|\.local$|node_modules/|/screenshots/|/tmp/|/logs/|/coverage/|playwright-report/|\.DS_Store'

git fetch --all --prune >/dev/null 2>&1
MAIN=$(git rev-parse origin/main)
echo "ORCHESTRATOR DECIDE @ origin/main=$(git rev-parse --short origin/main)  $(date '+%H:%M:%S')"
echo "------------------------------------------------------------------"

# Collecte des candidats: branches remote (hors main) + worktree branches + locales
collect () {
  git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -vE '^origin/(main|HEAD)$'
  git worktree list --porcelain | awk '/^branch /{print $2}' | sed 's#refs/heads/##' | grep -v '^main$'
  git for-each-ref --format='%(refname:short)' refs/heads | grep -v '^main$'
}

# Détecte si un fichier single-owner est touché par >1 candidat "en vol" (anti-collision)
# Construit d'abord la map fichier->branches pour les UNIQUE_WORK non-conflictuels.
declare -a CANDS
while read -r ref; do
  git rev-parse --verify -q "$ref" >/dev/null 2>&1 || continue
  [ "$(git rev-parse "$ref")" = "$MAIN" ] && continue
  git merge-base --is-ancestor "$ref" "$MAIN" 2>/dev/null && continue
  [ "$(git diff --name-only "$MAIN...$ref" 2>/dev/null | wc -l | tr -d ' ')" -eq 0 ] && continue
  CANDS+=("$ref")
done < <(collect | sort -u)

verdict () {
  local ref="$1"
  local files; files=$(git diff --name-only "$MAIN...$ref" 2>/dev/null)
  local ahead behind; ahead=$(git rev-list --count "$MAIN".."$ref"); behind=$(git rev-list --count "$ref".."$MAIN")
  # forbidden
  if echo "$files" | grep -qE "$FORBIDDEN_RE"; then echo "BLOCKED_FORBIDDEN | $ref | fichier interdit ($(echo "$files"|grep -E "$FORBIDDEN_RE"|head -1))"; return; fi
  # single-owner
  local so=""
  for f in $SINGLE_OWNER; do echo "$files" | grep -qxF "$f" && so="$so $f"; done
  # conflict?
  if ! git merge-tree --write-tree "$MAIN" "$ref" >/dev/null 2>&1; then
    echo "CONFLICT_REBASE | $ref | conflit avec main (ahead=$ahead behind=$behind) — l'agent doit rebaser${so:+ ; touche single-owner:$so}"; return
  fi
  if [ -n "$so" ]; then echo "REVIEW_SINGLE_OWNER | $ref | sans conflit MAIS touche single-owner:$so — validation requise"; return; fi
  # candidat propre → reste le gate typecheck (fait par l'agent sur worktree jetable)
  echo "MERGE_CANDIDATE | $ref | clean+mergeable (ahead=$ahead behind=$behind, files=$(echo "$files"|wc -l|tr -d ' ')) — exécuter gate typecheck puis merger"
}

if [ ${#CANDS[@]} -eq 0 ]; then echo "(aucun candidat avec travail unique non mergé)"; fi
for ref in "${CANDS[@]:-}"; do [ -n "$ref" ] && verdict "$ref"; done | sort

echo "------------------------------------------------------------------"
echo "Légende: MERGE_CANDIDATE→auto-merge après typecheck | CONFLICT_REBASE→agent rebase | REVIEW_SINGLE_OWNER→je valide | BLOCKED_FORBIDDEN→jamais"
