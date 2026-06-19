#!/usr/bin/env bash
# ============================================================================
# clean-workspace.sh — Nettoyage SUR du workspace Hearst Connect
# ----------------------------------------------------------------------------
# DRY-RUN PAR DEFAUT. Aucune suppression sans --apply.
# Ne touche JAMAIS un fichier suivi par git (garde git ls-files par chemin).
# Idempotent, re-jouable. Quote le chemin racine (espace + tiret cadratin).
#
# Usage :
#   scripts/clean-workspace.sh                 # dry-run, montre ce qui serait fait + Mo recuperes
#   scripts/clean-workspace.sh --apply         # archive la pollution racine dans .scratch/, elague les dossiers regenerables
#   scripts/clean-workspace.sh --apply --purge # SUPPRIME la pollution racine au lieu de l'archiver
#   scripts/clean-workspace.sh --apply --no-prune   # archive seulement, n'elague pas les dossiers lourds
#   scripts/clean-workspace.sh --apply --deep  # autorise aussi la suppression de node_modules (regenerable via pnpm install)
#
# Flags :
#   --apply       execute reellement (sinon dry-run)
#   --purge       supprime la pollution racine au lieu de l'archiver dans .scratch/
#   --no-prune    ne pas elaguer les dossiers regenerables lourds
#   --deep        inclut node_modules dans l'elagage (sinon laisse tranquille)
#   -h|--help     aide
# ============================================================================
set -euo pipefail

# --- Racine du repo : toujours quotee (espace + tiret cadratin dans le chemin) ---
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Garde : doit etre un repo git ---
if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERREUR : $ROOT n'est pas un repo git. Abandon." >&2
  exit 1
fi

# --- Parsing des flags ---
APPLY=0; PURGE=0; PRUNE=1; DEEP=0
for arg in "$@"; do
  case "$arg" in
    --apply)    APPLY=1 ;;
    --purge)    PURGE=1 ;;
    --no-prune) PRUNE=0 ;;
    --deep)     DEEP=1 ;;
    -h|--help)
      sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)
      echo "Flag inconnu : $arg (voir --help)" >&2; exit 2 ;;
  esac
done

# --- Cosmetique ---
if [ "$APPLY" -eq 1 ]; then MODE="APPLY"; else MODE="DRY-RUN"; fi
echo "========================================================================"
echo " clean-workspace — mode: $MODE  | purge: $PURGE | prune: $PRUNE | deep: $DEEP"
echo " repo: $ROOT"
echo "========================================================================"
[ "$APPLY" -eq 0 ] && echo "(DRY-RUN — rien ne sera supprime ni deplace. Ajoute --apply pour executer.)"
echo

# --- Compteurs ---
RECLAIM_BYTES=0
SKIPPED_TRACKED=0
MOVED=0
PRUNED=0

# du -sk portable (octets via blocs 1K), 0 si absent
size_kb() {
  local p="$1"
  [ -e "$p" ] || { echo 0; return; }
  du -sk "$p" 2>/dev/null | awk '{print $1}'
}

human() {
  awk -v b="$1" 'BEGIN{ split("B KB MB GB TB",u); s=b; i=1; while(s>=1024 && i<5){s/=1024;i++} printf "%.1f %s", s, u[i] }'
}

# Vrai (0) si le chemin est suivi par git -> on NE TOUCHE PAS.
is_tracked() {
  git -C "$ROOT" ls-files --error-unmatch -- "$1" >/dev/null 2>&1
}

# Vrai (0) si un dossier contient AU MOINS un fichier suivi par git.
dir_has_tracked() {
  [ -n "$(git -C "$ROOT" ls-files -- "$1" 2>/dev/null | head -n1)" ]
}

# --- Action sur un fichier de pollution racine : archive ou purge, avec garde tracked ---
# $1 = chemin relatif, $2 = sous-dossier d'archive (.scratch/<sub>)
handle_file() {
  local f="$1" sub="$2"
  [ -e "$f" ] || return 0
  if is_tracked "$f"; then
    echo "  SKIP (suivi par git, jamais touche) : $f"
    SKIPPED_TRACKED=$((SKIPPED_TRACKED+1))
    return 0
  fi
  local kb; kb=$(size_kb "$f"); RECLAIM_BYTES=$((RECLAIM_BYTES + kb*1024))
  if [ "$PURGE" -eq 1 ]; then
    if [ "$APPLY" -eq 1 ]; then rm -f -- "$f"; fi
    echo "  PURGE : $f  ($(human $((kb*1024))))"
  else
    local dest=".scratch/$sub"
    if [ "$APPLY" -eq 1 ]; then mkdir -p "$dest"; mv -f -- "$f" "$dest/"; fi
    echo "  ARCHIVE -> $dest/ : $f  ($(human $((kb*1024))))"
  fi
  MOVED=$((MOVED+1))
}

# --- Elagage d'un dossier regenerable, avec garde dir-has-tracked ---
prune_dir() {
  local d="$1"
  [ -e "$d" ] || return 0
  if dir_has_tracked "$d"; then
    echo "  SKIP (contient des fichiers suivis par git) : $d/"
    SKIPPED_TRACKED=$((SKIPPED_TRACKED+1))
    return 0
  fi
  local kb; kb=$(size_kb "$d"); RECLAIM_BYTES=$((RECLAIM_BYTES + kb*1024))
  if [ "$APPLY" -eq 1 ]; then rm -rf -- "$d"; fi
  echo "  PRUNE : $d/  ($(human $((kb*1024))))"
  PRUNED=$((PRUNED+1))
}

# ============================================================================
# (a) POLLUTION RACINE -> .scratch/ (ou --purge)
# ============================================================================
echo "[a] Pollution racine (captures / scripts scratch / rapports) :"

# Captures racine : *.png *.jpeg *.jpg (gitignores par /*.png etc.) -> .scratch/screenshots
while IFS= read -r -d '' f; do handle_file "${f#./}" "screenshots"; done < <(
  find . -maxdepth 1 -type f \( -name '*.png' -o -name '*.jpeg' -o -name '*.jpg' \) -print0 2>/dev/null
)

# Scripts scratch racine -> .scratch/scripts  (le garde sautera ceux suivis par git)
for f in scan_admin_after.js scan_admin_before.js scan_qa_v1.js scan_qa_v1.py \
         screenshot-admin.js screenshot.js audit_profile.py; do
  handle_file "$f" "scripts"
done

# Rapports HTML d'audit racine -> .scratch/reports  (qa-report-*.html est SUIVI -> saute auto)
while IFS= read -r -d '' f; do handle_file "${f#./}" "reports"; done < <(
  find . -maxdepth 1 -type f -name '*.html' -print0 2>/dev/null
)
handle_file "portfolio_body.html" "reports"

# Divers artefacts racine
handle_file "dev.db" "misc"
handle_file "tsconfig.tsbuildinfo" "misc"

echo

# ============================================================================
# (b) DOSSIERS REGENERABLES LOURDS -> prune
# ============================================================================
if [ "$PRUNE" -eq 1 ]; then
  echo "[b] Dossiers regenerables lourds :"
  # Tous regenerables : build (next build), playwright (replay), release (electron-builder
  # SCRATCH), jscpd/test-results/playwright-report (re-run), tmp/.tmp (scratch).
  # NB: `releases/` (au pluriel) est VOLONTAIREMENT exclu — il contient les DMG
  # shippes + un CREDENTIALS.md (artefacts curés, NON regenerables sans rebuild signé).
  for d in .next .playwright-mcp release .jscpd-report test-results \
           playwright-report dist-electron build .tmp tmp; do
    prune_dir "$d"
  done
  # node_modules : laisse tranquille sauf --deep (regenerable via pnpm install)
  if [ "$DEEP" -eq 1 ]; then
    prune_dir "node_modules"
  else
    [ -d node_modules ] && echo "  KEEP : node_modules/ (utilise --deep pour l'elaguer)"
  fi
  echo
else
  echo "[b] Elagage des dossiers lourds desactive (--no-prune)."
  echo
fi

# ============================================================================
# RECAP
# ============================================================================
echo "------------------------------------------------------------------------"
echo " Recap :"
echo "   fichiers racine traites (archive/purge) : $MOVED"
echo "   dossiers elagues                        : $PRUNED"
echo "   ignores car suivis par git (intacts)    : $SKIPPED_TRACKED"
echo "   espace recuperable estime               : $(human "$RECLAIM_BYTES")"
echo "------------------------------------------------------------------------"
if [ "$APPLY" -eq 0 ]; then
  echo " DRY-RUN — relance avec --apply pour executer."
else
  echo " Termine. (Aucun git add/commit/push effectue — staging manuel cible.)"
fi
if [ "$SKIPPED_TRACKED" -gt 0 ]; then
  echo
  echo " ATTENTION : $SKIPPED_TRACKED chemin(s) suivis par git ont ete SAUTES."
  echo " Si tu veux vraiment les sortir du repo, c'est une decision manuelle :"
  echo "   git rm --cached <chemin>   puis  git commit  (jamais automatise ici)."
fi
exit 0
