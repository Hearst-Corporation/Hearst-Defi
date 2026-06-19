#!/usr/bin/env bash
# ds-lock-check.sh — Verrou d'invariants Design System (DRIFT-ONLY, read-only).
#
# Construit SUR le green-drift gate déjà finalisé (commit acf2ec9). N'arme AUCUN
# gate lourd (layout/classes) retiré par Adrien : le DS reste librement éditable.
# Ce script vérifie UNIQUEMENT que les invariants « un seul vert » tiennent.
#
# Invariants asservis :
#   1. scripts/ds-token-drift.mjs passe (brand assertion + taxonomie tokens).
#   2. --ct-accent: #A7FB90 défini EXACTEMENT une fois (dans cockpit-shell/tokens.css).
#   3. Aucun hex vert parasite (#16a34a, #06140a-comme-vert, etc.) HORS définition
#      de token, commentaires CSS strippés (le #16a34a du commentaire pdf est ignoré ;
#      --ct-text-on-accent: #06140A est un foreground noir, exempté).
#   4. Aucun namespace --ds-* (le seul namespace runtime est --ct-*).
#   5. Ordre de cascade intact dans src/app/layout.tsx :
#        tokens-layer.css (qui @import cockpit-shell/tokens.css) -> globals.css -> cockpit.css
#      cockpit.css importé EN DERNIER (unlayered = gagne la cascade).
#
# Usage :
#   bash scripts/ds-lock-check.sh           # check complet, exit 1 sur drift
#   bash scripts/ds-lock-check.sh --quiet   # n'affiche que les échecs
#
# Idempotent, ne touche AUCUN fichier. Sûr à relancer N fois.
set -euo pipefail

# ── Racine repo (robuste : chemin avec espace + em-dash) ──────────────────────
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
ROOT="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

TOKENS_CSS="${ROOT}/cockpit-shell/tokens.css"
COCKPIT_CSS="${ROOT}/src/app/cockpit.css"
GLOBALS_CSS="${ROOT}/src/app/globals.css"
TOKENS_LAYER_CSS="${ROOT}/src/app/tokens-layer.css"
LAYOUT_TSX="${ROOT}/src/app/layout.tsx"

FAILED=0
pass() { [ "${QUIET}" -eq 1 ] || printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1" >&2; FAILED=1; }
step() { [ "${QUIET}" -eq 1 ] || printf '\n\033[1m%s\033[0m\n' "$1"; }

for f in "${TOKENS_CSS}" "${COCKPIT_CSS}" "${GLOBALS_CSS}" "${TOKENS_LAYER_CSS}" "${LAYOUT_TSX}"; do
  if [ ! -f "${f}" ]; then
    fail "Fichier de cascade manquant : ${f#${ROOT}/}"
  fi
done
[ "${FAILED}" -eq 1 ] && { echo; echo 'ds-lock-check: cascade incomplète, abandon.' >&2; exit 1; }

# Helper : strippe les commentaires CSS (/* ... */) d'un fichier vers stdout.
# Aligne le comportement sur ds-token-drift.mjs (un hex en commentaire n'est PAS
# une définition). Implémenté en awk pour gérer les blocs multi-lignes.
strip_css_comments() {
  awk 'BEGIN{c=0}
    { line=$0; out=""
      while (length(line)>0) {
        if (c==0) { i=index(line,"/*")
          if (i==0) { out=out line; line="" }
          else { out=out substr(line,1,i-1); line=substr(line,i+2); c=1 } }
        else { i=index(line,"*/")
          if (i==0) { line="" }
          else { line=substr(line,i+2); c=0 } } }
      print out }' "$1"
}

# ── STEP 1 — Réutilise le drift gate existant (source de vérité brand) ─────────
step '1/5  Token drift (réutilise scripts/ds-token-drift.mjs)'
if node "${ROOT}/scripts/ds-token-drift.mjs" >/tmp/ds-lock-drift.$$.log 2>&1; then
  pass 'ds-token-drift : brand assertion + taxonomie OK'
else
  fail 'ds-token-drift a échoué — voir détail :'
  sed 's/^/        /' /tmp/ds-lock-drift.$$.log >&2
fi
rm -f /tmp/ds-lock-drift.$$.log

# ── STEP 2 — --ct-accent défini exactement une fois, = #A7FB90 ────────────────
step '2/5  Accent unique : --ct-accent = #A7FB90 (une seule définition)'
ACCENT_DEFS="$(grep -rniE -- '--ct-accent[[:space:]]*:[[:space:]]*#[0-9a-f]{3,8}' \
  "${TOKENS_CSS}" "${COCKPIT_CSS}" "${GLOBALS_CSS}" 2>/dev/null || true)"
ACCENT_COUNT="$(printf '%s' "${ACCENT_DEFS}" | grep -c . || true)"
if [ "${ACCENT_COUNT}" -ne 1 ]; then
  fail "--ct-accent défini ${ACCENT_COUNT} fois (attendu : 1, dans cockpit-shell/tokens.css)"
  printf '%s\n' "${ACCENT_DEFS}" | sed 's/^/        /' >&2
else
  if printf '%s' "${ACCENT_DEFS}" | grep -qiE '#a7fb90'; then
    pass '--ct-accent = #A7FB90, défini une seule fois'
  else
    fail "--ct-accent défini une fois mais != #A7FB90 :"
    printf '%s\n' "${ACCENT_DEFS}" | sed 's/^/        /' >&2
  fi
fi

# ── STEP 3 — Aucun vert parasite hors token (commentaires strippés) ───────────
# On cherche des hex VERTS connus-interdits (#16a34a et famille web-green Tailwind)
# ailleurs que dans la définition de --ct-accent. Les commentaires sont strippés
# (le #16a34a du commentaire pdf-palette est donc ignoré). --ct-text-on-accent:
# #06140A est un FOREGROUND noir (pas un vert) -> exempté explicitement.
step '3/5  Zéro vert parasite hors --ct-accent'
FORBIDDEN_GREENS='#16a34a|#22c55e|#15803d|#16a249|#4ade80|#86efac|#21c45d'
for f in "${TOKENS_CSS}" "${COCKPIT_CSS}" "${GLOBALS_CSS}"; do
  HITS="$(strip_css_comments "${f}" \
    | grep -niE -- "${FORBIDDEN_GREENS}" \
    | grep -viE -- '--ct-accent' \
    | grep -viE -- '--ct-text-on-accent' || true)"
  if [ -n "${HITS}" ]; then
    fail "Vert parasite dans ${f#${ROOT}/} :"
    printf '%s\n' "${HITS}" | sed 's/^/        /' >&2
  fi
done
[ "${FAILED}" -eq 0 ] && pass 'aucun hex vert parasite (#16a34a & famille) hors token'

# ── STEP 4 — Aucun namespace --ds-* ───────────────────────────────────────────
step '4/5  Zéro namespace --ds-* (seul --ct-* autorisé)'
DS_HITS="$(grep -rniE -- '--ds-[a-z0-9-]+[[:space:]]*:' \
  "${TOKENS_CSS}" "${COCKPIT_CSS}" "${GLOBALS_CSS}" 2>/dev/null || true)"
if [ -n "${DS_HITS}" ]; then
  fail 'namespace --ds-* détecté (interdit, utiliser --ct-*) :'
  printf '%s\n' "${DS_HITS}" | sed 's/^/        /' >&2
else
  pass 'aucun --ds-* — namespace runtime = --ct-* uniquement'
fi

# ── STEP 5 — Ordre de cascade intact dans layout.tsx ──────────────────────────
# Attendu (ordre d'import = ordre de cascade) :
#   import "./tokens-layer.css";  (qui @import cockpit-shell/tokens.css layer(cockpit))
#   import "./globals.css";
#   import "./cockpit.css";       (DERNIER, unlayered -> gagne)
step '5/5  Ordre de cascade : tokens-layer -> globals -> cockpit (layout.tsx)'
LN_TOKENS="$(grep -n -- 'import "./tokens-layer.css"' "${LAYOUT_TSX}" | head -1 | cut -d: -f1 || true)"
LN_GLOBALS="$(grep -n -- 'import "./globals.css"' "${LAYOUT_TSX}" | head -1 | cut -d: -f1 || true)"
LN_COCKPIT="$(grep -n -- 'import "./cockpit.css"' "${LAYOUT_TSX}" | head -1 | cut -d: -f1 || true)"
if [ -z "${LN_TOKENS}" ] || [ -z "${LN_GLOBALS}" ] || [ -z "${LN_COCKPIT}" ]; then
  fail "import CSS manquant dans layout.tsx (tokens-layer=${LN_TOKENS:-x} globals=${LN_GLOBALS:-x} cockpit=${LN_COCKPIT:-x})"
elif [ "${LN_TOKENS}" -lt "${LN_GLOBALS}" ] && [ "${LN_GLOBALS}" -lt "${LN_COCKPIT}" ]; then
  pass "ordre OK : tokens-layer(${LN_TOKENS}) < globals(${LN_GLOBALS}) < cockpit(${LN_COCKPIT})"
else
  fail "ordre de cascade rompu : tokens-layer=${LN_TOKENS} globals=${LN_GLOBALS} cockpit=${LN_COCKPIT}"
  fail '  attendu : tokens-layer < globals < cockpit (cockpit importé en dernier)'
fi
# tokens-layer.css doit bien @import le tokens.css du shell (source de l'accent).
if ! grep -qE 'cockpit-shell/tokens.css' "${TOKENS_LAYER_CSS}"; then
  fail 'tokens-layer.css n@import plus cockpit-shell/tokens.css — source accent rompue'
else
  pass 'tokens-layer.css @import bien cockpit-shell/tokens.css (source accent)'
fi

# ── Verdict ───────────────────────────────────────────────────────────────────
echo
if [ "${FAILED}" -ne 0 ]; then
  echo 'ds-lock-check: ECHEC — drift d invariant DS detecte (voir FAIL ci-dessus).' >&2
  exit 1
fi
echo 'ds-lock-check: OK — invariants « un seul vert » intacts, DS libre d edition.'
exit 0
