#!/usr/bin/env bash
# Orchestrateur — DÉTECTEUR DE RÉGRESSION / ÉCRASEMENT (read-only).
# Usage: bash regression-check.sh <ref-de-la-branche>
# Vérifie qu'intégrer <ref> n'écrase PAS du travail récent de main et ne supprime
# pas de fichiers/lignes que main a fait évoluer. N'écrit RIEN.
# Sortie: lignes "RISK | <type> | <détail>". Aucun RISK = sûr à merger.
set -uo pipefail
REPO="/Users/adrienbeyondcrypto/Dev/Hearst Corporation/connect — Hearst Defi"
cd "$REPO" || exit 2
REF="${1:?usage: regression-check.sh <ref>}"
git fetch origin >/dev/null 2>&1
MAIN=$(git rev-parse origin/main)
BASE=$(git merge-base "$MAIN" "$REF" 2>/dev/null)

echo "## REGRESSION-CHECK $REF vs origin/main ($(git rev-parse --short $MAIN)) — base $(git rev-parse --short $BASE)"

# 1) Fichiers que la branche modifie ET que main a fait évoluer DEPUIS la base
#    commune = zone de divergence → risque d'écrasement (la branche peut revenir
#    en arrière sur le travail récent de main).
echo "### Fichiers modifiés des DEUX côtés depuis la base (zone de divergence)"
branch_files=$(git diff --name-only "$BASE" "$REF")
main_files=$(git diff --name-only "$BASE" "$MAIN")
overlap=$(comm -12 <(echo "$branch_files" | sort) <(echo "$main_files" | sort))
if [ -z "$overlap" ]; then
  echo "  (aucun) — la branche et main ont touché des fichiers disjoints, pas d'écrasement possible"
else
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # La branche supprime-t-elle des lignes que main a AJOUTÉES depuis la base ?
    # On compare ce que main a ajouté (base→main) vs ce que la branche retire (base→ref).
    main_added=$(git diff "$BASE" "$MAIN" -- "$f" | grep -c '^+[^+]')
    branch_removed=$(git diff "$BASE" "$REF" -- "$f" | grep -c '^-[^-]')
    echo "  RISK | OVERLAP | $f (main +$main_added lignes depuis base ; la branche en retire $branch_removed) — vérifier que le merge ne perd pas le travail de main"
  done <<< "$overlap"
fi

# 2) Fichiers que la branche SUPPRIME mais qui existent sur main → perte potentielle
echo "### Suppressions de fichiers présents sur main"
del=$(git diff --name-status "$BASE" "$REF" | awk '$1=="D"{print $2}')
any_del=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if git cat-file -e "$MAIN:$f" 2>/dev/null; then echo "  RISK | DELETE | $f supprimé par la branche mais présent sur main"; any_del=1; fi
done <<< "$del"
[ "$any_del" -eq 0 ] && echo "  (aucune)"

# 3) Le merge réel ferait-il "reculer" un fichier (résultat = ancienne version de main) ?
#    On simule le merge à blanc et on compare chaque fichier overlap au main actuel :
#    si le merge produit un fichier == base (et != main), la branche a écrasé main.
echo "### Vérif merge: fichiers qui reviendraient à l'état base (écrasement de main)"
TMP="../.orchestrator-regcheck"
git worktree remove --force "$TMP" 2>/dev/null; git worktree prune 2>/dev/null
git worktree add -d "$TMP" "$MAIN" >/dev/null 2>&1
if git -C "$TMP" merge --no-ff --no-commit "$REF" >/dev/null 2>&1; then
  any_back=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    merged=$(git -C "$TMP" hash-object "$f" 2>/dev/null)
    onmain=$(git rev-parse "$MAIN:$f" 2>/dev/null)
    onbase=$(git rev-parse "$BASE:$f" 2>/dev/null)
    if [ -n "$merged" ] && [ "$merged" != "$onmain" ] && [ "$merged" = "$onbase" ]; then
      echo "  RISK | REVERT | $f : le merge ramène ce fichier à l'état base (= annule le travail récent de main)"; any_back=1
    fi
  done <<< "$overlap"
  [ "$any_back" -eq 0 ] && echo "  (aucun) — le merge ne fait reculer aucun fichier"
  git -C "$TMP" merge --abort 2>/dev/null
else
  echo "  CONFLICT — merge à blanc impossible (devrait être attrapé en amont)"
  git -C "$TMP" merge --abort 2>/dev/null
fi
git worktree remove --force "$TMP" 2>/dev/null; git worktree prune 2>/dev/null

echo "## END REGRESSION-CHECK"
