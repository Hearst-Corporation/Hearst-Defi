#!/usr/bin/env bash
# ============================================================================
#  audit-connections.sh — Hearst Connect — AXIS 1
#  Health-check READ-ONLY de TOUTES les connexions du projet.
#  - Git (remote joignable + gh auth)
#  - DB (Prisma generate dry + ping $queryRaw, SQLite dev / Postgres prod)
#  - APIs externes (OpenAI, Supabase, Vercel, GitHub, Cloudflare, Resend,
#    Sentry, HubSpot) — UNIQUEMENT codes HTTP, jamais le token
#  - Serveurs distants (gpu1, gpu2-remote, tailscale)
#  - MCP (claude mcp list -> connected/failed)
#
#  Lecture seule : aucune ecriture, aucun fichier tracke touche.
#  Secrets sources depuis .env.local + env shell, JAMAIS imprimes.
#  Chaque appel reseau est borne par `timeout`.
#  Exit != 0 si au moins un FAIL CRITIQUE (Git remote, DB).
#
#  Usage:
#    bash scripts/audit-connections.sh            # tout
#    bash scripts/audit-connections.sh --only db,apis,mcp
#    bash scripts/audit-connections.sh --no-remote   # saute gpu1/gpu2/tailscale
#    bash scripts/audit-connections.sh --quiet        # tableau seul
# ============================================================================
set -euo pipefail

# --- Racine du repo (chemin avec ESPACE et EM-DASH -> tout est quote) --------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
ROOT="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"
cd "${ROOT}"

# --- Couleurs (desactivees si pas un TTY) ------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_GREEN=$'\033[32m'; C_RED=$'\033[31m'
  C_YEL=$'\033[33m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_CYAN=$'\033[36m'
else
  C_RESET=''; C_GREEN=''; C_RED=''; C_YEL=''; C_DIM=''; C_BOLD=''; C_CYAN=''
fi

# --- Options ----------------------------------------------------------------
ONLY=""; DO_REMOTE=1; QUIET=0; NET_TIMEOUT=8; SSH_TIMEOUT=5
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2;;
    --only=*) ONLY="${1#*=}"; shift;;
    --no-remote) DO_REMOTE=0; shift;;
    --quiet) QUIET=1; shift;;
    --timeout) NET_TIMEOUT="${2:-8}"; shift 2;;
    -h|--help) grep -E '^#' "${BASH_SOURCE[0]}" | sed -E 's/^# ?//'; exit 0;;
    *) echo "Option inconnue : $1" >&2; exit 2;;
  esac
done

want() { # want <section> -> 0 si la section doit tourner
  [[ -z "$ONLY" ]] && return 0
  [[ ",${ONLY}," == *",$1,"* ]]
}

# --- timeout portable (macOS: gtimeout via coreutils, sinon fallback) --------
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN=timeout
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN=gtimeout
else TIMEOUT_BIN=""; fi
to() { # to <secs> <cmd...> — borne un appel ; degrade proprement si pas de timeout(1)
  local secs="$1"; shift
  if [[ -n "$TIMEOUT_BIN" ]]; then "$TIMEOUT_BIN" "${secs}" "$@"; else "$@"; fi
}

# --- Chargement des secrets depuis .env.local (SANS jamais les imprimer) -----
# On parse ligne a ligne (KEY=VALUE), on ignore commentaires/lignes vides,
# on n'evalue JAMAIS la valeur (pas de `source`, pas d'expansion shell).
load_env() {
  local f="${ROOT}/.env.local"
  [[ -f "$f" ]] || { f="${ROOT}/.env"; }
  [[ -f "$f" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"          # ltrim
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"; val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"            # rtrim cle
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # retire guillemets entourants eventuels
    if [[ "$val" == \"*\" ]]; then val="${val#\"}"; val="${val%\"}"; fi
    if [[ "$val" == \'*\' ]]; then val="${val#\'}"; val="${val%\'}"; fi
    # ne PAS ecraser une var deja presente dans l'env shell (priorite shell)
    [[ -n "${!key:-}" ]] && continue
    printf -v "$key" '%s' "$val"; export "${key?}"
  done < "$f"
}
load_env

# --- Tableau de resultats ----------------------------------------------------
ROWS=()         # "STATUS\tCATEGORIE\tCIBLE\tDETAIL"
FAIL_CRIT=0     # nb de FAIL critiques
FAIL_SOFT=0     # nb de FAIL non-critiques (WARN)

row() { # row <STATUS OK|FAIL|WARN|SKIP> <crit 0|1> <categorie> <cible> <detail>
  local status="$1" crit="$2" cat="$3" target="$4" detail="$5"
  ROWS+=("${status}"$'\t'"${cat}"$'\t'"${target}"$'\t'"${detail}")
  case "$status" in
    FAIL) [[ "$crit" == 1 ]] && FAIL_CRIT=$((FAIL_CRIT+1)) || FAIL_SOFT=$((FAIL_SOFT+1));;
    WARN) FAIL_SOFT=$((FAIL_SOFT+1));;
  esac
  if [[ "$QUIET" == 0 ]]; then
    local col="$C_DIM"
    case "$status" in OK) col="$C_GREEN";; FAIL) col="$C_RED";; WARN) col="$C_YEL";; SKIP) col="$C_DIM";; esac
    printf '  %s%-4s%s %-10s %-22s %s\n' "$col" "$status" "$C_RESET" "$cat" "$target" "$detail"
  fi
}

section() { [[ "$QUIET" == 0 ]] && printf '\n%s== %s ==%s\n' "$C_BOLD$C_CYAN" "$1" "$C_RESET"; }

# helper: vrai si une var est non-vide (sans imprimer sa valeur)
has() { [[ -n "${!1:-}" ]]; }

# helper: appel HTTP -> renvoie le code HTTP sur stdout (jamais le corps)
# usage: http_code <secs> curl-args...
http_code() {
  local secs="$1"; shift
  to "$secs" curl -fsS -o /dev/null -w '%{http_code}' \
    --connect-timeout "$secs" --max-time "$((secs+2))" "$@" 2>/dev/null || echo "000"
}
# Variante qui tolere les 4xx (auth verifiee = on veut juste "ca repond")
http_code_soft() {
  local secs="$1"; shift
  to "$secs" curl -sS -o /dev/null -w '%{http_code}' \
    --connect-timeout "$secs" --max-time "$((secs+2))" "$@" 2>/dev/null || echo "000"
}

# ============================================================================
#  1) GIT  (CRITIQUE)
# ============================================================================
if want git; then
  section "Git"
  if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    row OK 0 git "repo" "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD) @ $(git -C "$ROOT" rev-parse --short HEAD)"
  else
    row FAIL 1 git "repo" "pas un depot git"
  fi
  # remote joignable
  if to "$NET_TIMEOUT" git -C "$ROOT" ls-remote --heads origin >/dev/null 2>&1; then
    row OK 1 git "origin (ls-remote)" "joignable"
  else
    row FAIL 1 git "origin (ls-remote)" "INJOIGNABLE (timeout/auth/reseau)"
  fi
  # gh auth
  if command -v gh >/dev/null 2>&1; then
    if to "$NET_TIMEOUT" gh auth status >/dev/null 2>&1; then
      row OK 0 git "gh auth" "connecte"
    else
      row WARN 0 git "gh auth" "gh non authentifie (gh auth login)"
    fi
  else
    row SKIP 0 git "gh" "gh CLI absent"
  fi
fi

# ============================================================================
#  2) DB  (CRITIQUE) — Prisma generate (dry) + ping $queryRaw
# ============================================================================
if want db; then
  section "Base de donnees (Prisma)"
  # DATABASE_URL present ?
  if ! has DATABASE_URL; then
    row FAIL 1 db "DATABASE_URL" "absent (.env.local / env)"
  else
    # Detecte le moteur SANS imprimer l'URL (juste le schema)
    case "${DATABASE_URL}" in
      file:*|sqlite:*) DB_KIND="sqlite (dev)";;
      postgres://*|postgresql://*) DB_KIND="postgres (prod/supabase)";;
      *) DB_KIND="inconnu";;
    esac
    row OK 0 db "DATABASE_URL" "present — ${DB_KIND}"
  fi

  # prisma generate en mode "dry" (validation du schema, pas de reseau)
  if [[ -x "${ROOT}/node_modules/.bin/prisma" ]]; then
    if to 60 "${ROOT}/node_modules/.bin/prisma" validate >/dev/null 2>&1; then
      row OK 0 db "prisma validate" "schema valide"
    else
      row FAIL 1 db "prisma validate" "schema invalide"
    fi

    # Ping reel : node + prisma $queryRaw SELECT 1 (borne par timeout)
    if has DATABASE_URL; then
      if to 25 node --input-type=module -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
try { await p.$queryRawUnsafe("SELECT 1"); process.exit(0); }
catch (e) { console.error(String(e?.code || e?.message || "err")); process.exit(1); }
finally { await p.$disconnect().catch(()=>{}); }
' >/dev/null 2>&1; then
        row OK 1 db "ping SELECT 1" "OK (${DB_KIND:-?})"
      else
        row FAIL 1 db "ping SELECT 1" "echec connexion DB"
      fi
    fi
  else
    row SKIP 0 db "prisma" "binaire absent (pnpm install)"
  fi
fi

# ============================================================================
#  3) APIs EXTERNES — codes HTTP UNIQUEMENT, jamais le token
# ============================================================================
if want apis; then
  section "APIs externes (codes HTTP — aucun secret imprime)"

  # OpenAI — GET /v1/models avec Authorization
  if has OPENAI_API_KEY; then
    base="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${OPENAI_API_KEY}" "${base}/models")
    case "$code" in 200) row OK 0 api "OpenAI /models" "HTTP 200 — cle valide";;
      401|403) row FAIL 0 api "OpenAI /models" "HTTP $code — cle rejetee";;
      000) row FAIL 0 api "OpenAI /models" "injoignable/timeout";;
      *) row WARN 0 api "OpenAI /models" "HTTP $code";; esac
  else
    row SKIP 0 api "OpenAI" "OPENAI_API_KEY absent"
  fi

  # Supabase — GET <url>/rest/v1/ avec apikey (service role)
  if has NEXT_PUBLIC_SUPABASE_URL && has SUPABASE_SERVICE_ROLE_KEY; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
           -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
           "${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/")
    case "$code" in 200) row OK 0 api "Supabase REST" "HTTP 200";;
      401|403) row FAIL 0 api "Supabase REST" "HTTP $code — apikey rejetee";;
      000) row FAIL 0 api "Supabase REST" "injoignable/timeout";;
      *) row WARN 0 api "Supabase REST" "HTTP $code";; esac
  else
    row SKIP 0 api "Supabase" "URL ou SERVICE_ROLE_KEY absent"
  fi

  # Vercel — GET /v2/user (VERCEL_TOKEN depuis env shell, pas dans .env.local)
  if has VERCEL_TOKEN; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${VERCEL_TOKEN}" \
           "https://api.vercel.com/v2/user")
    case "$code" in 200) row OK 0 api "Vercel /v2/user" "HTTP 200";;
      401|403) row FAIL 0 api "Vercel /v2/user" "HTTP $code — token rejete";;
      000) row FAIL 0 api "Vercel /v2/user" "injoignable/timeout";;
      *) row WARN 0 api "Vercel /v2/user" "HTTP $code";; esac
  else
    row SKIP 0 api "Vercel" "VERCEL_TOKEN absent (env shell)"
  fi

  # GitHub — gh api user (utilise l'auth gh / GITHUB_TOKEN)
  if command -v gh >/dev/null 2>&1; then
    if to "$NET_TIMEOUT" gh api user --jq '.login' >/dev/null 2>&1; then
      row OK 0 api "GitHub (gh api user)" "HTTP 200"
    else
      # fallback REST direct si GITHUB_TOKEN present
      if has GITHUB_TOKEN; then
        code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${GITHUB_TOKEN}" \
               -H "X-GitHub-Api-Version: 2022-11-28" "https://api.github.com/user")
        case "$code" in 200) row OK 0 api "GitHub /user" "HTTP 200";;
          401|403) row FAIL 0 api "GitHub /user" "HTTP $code — token rejete";;
          *) row WARN 0 api "GitHub /user" "HTTP $code";; esac
      else
        row WARN 0 api "GitHub" "gh non auth + GITHUB_TOKEN absent"
      fi
    fi
  elif has GITHUB_TOKEN; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${GITHUB_TOKEN}" \
           "https://api.github.com/user")
    [[ "$code" == 200 ]] && row OK 0 api "GitHub /user" "HTTP 200" || row WARN 0 api "GitHub /user" "HTTP $code"
  else
    row SKIP 0 api "GitHub" "gh + GITHUB_TOKEN absents"
  fi

  # Cloudflare — GET /user/tokens/verify
  if has CLOUDFLARE_API_TOKEN; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
           "https://api.cloudflare.com/client/v4/user/tokens/verify")
    case "$code" in 200) row OK 0 api "Cloudflare verify" "HTTP 200 — token actif";;
      401|403) row FAIL 0 api "Cloudflare verify" "HTTP $code — token rejete";;
      000) row FAIL 0 api "Cloudflare verify" "injoignable/timeout";;
      *) row WARN 0 api "Cloudflare verify" "HTTP $code";; esac
  else
    row SKIP 0 api "Cloudflare" "CLOUDFLARE_API_TOKEN absent"
  fi

  # Resend — GET /domains (auth Bearer)
  if has RESEND_API_KEY; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${RESEND_API_KEY}" \
           "https://api.resend.com/domains")
    case "$code" in 200) row OK 0 api "Resend /domains" "HTTP 200";;
      401|403) row FAIL 0 api "Resend /domains" "HTTP $code — cle rejetee";;
      000) row FAIL 0 api "Resend /domains" "injoignable/timeout";;
      *) row WARN 0 api "Resend /domains" "HTTP $code";; esac
  else
    row SKIP 0 api "Resend" "RESEND_API_KEY absent"
  fi

  # Sentry — GET /api/0/ (auth Bearer via SENTRY_AUTH_TOKEN)
  if has SENTRY_AUTH_TOKEN; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
           "https://sentry.io/api/0/")
    case "$code" in 200) row OK 0 api "Sentry /api/0" "HTTP 200";;
      401|403) row FAIL 0 api "Sentry /api/0" "HTTP $code — token rejete";;
      000) row FAIL 0 api "Sentry /api/0" "injoignable/timeout";;
      *) row WARN 0 api "Sentry /api/0" "HTTP $code";; esac
  else
    row SKIP 0 api "Sentry" "SENTRY_AUTH_TOKEN absent"
  fi

  # HubSpot — GET /crm/v3/objects/contacts?limit=1 (PAT Bearer)
  if has HUBSPOT_API_KEY; then
    code=$(http_code_soft "$NET_TIMEOUT" -H "Authorization: Bearer ${HUBSPOT_API_KEY}" \
           "https://api.hubapi.com/crm/v3/objects/contacts?limit=1")
    case "$code" in 200) row OK 0 api "HubSpot contacts" "HTTP 200";;
      401|403) row FAIL 0 api "HubSpot contacts" "HTTP $code — PAT rejete";;
      000) row FAIL 0 api "HubSpot contacts" "injoignable/timeout";;
      *) row WARN 0 api "HubSpot contacts" "HTTP $code";; esac
  else
    row SKIP 0 api "HubSpot" "HUBSPOT_API_KEY absent"
  fi
fi

# ============================================================================
#  4) SERVEURS DISTANTS — SSH gpu1 / gpu2-remote + tailscale
# ============================================================================
if want remote && [[ "$DO_REMOTE" == 1 ]]; then
  section "Serveurs distants (SSH / Tailscale)"
  SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout="${SSH_TIMEOUT}" -o StrictHostKeyChecking=accept-new)

  # gpu1 — nvidia-smi -L
  if command -v ssh >/dev/null 2>&1; then
    if n=$(to $((SSH_TIMEOUT+5)) ssh "${SSH_OPTS[@]}" gpu1 'nvidia-smi -L 2>/dev/null | wc -l' 2>/dev/null); then
      [[ "${n// /}" =~ ^[0-9]+$ && "${n// /}" -gt 0 ]] \
        && row OK 0 remote "gpu1 nvidia-smi" "${n// /} GPU(s)" \
        || row WARN 0 remote "gpu1 nvidia-smi" "joignable, 0 GPU detecte"
    else
      row WARN 0 remote "gpu1" "SSH injoignable (timeout/cle)"
    fi

    # gpu2-remote — uptime
    if to $((SSH_TIMEOUT+5)) ssh "${SSH_OPTS[@]}" gpu2-remote 'uptime' >/dev/null 2>&1; then
      row OK 0 remote "gpu2-remote uptime" "joignable"
    else
      row WARN 0 remote "gpu2-remote" "SSH injoignable (timeout/cle)"
    fi
  else
    row SKIP 0 remote "ssh" "client ssh absent"
  fi

  # tailscale status
  if command -v tailscale >/dev/null 2>&1; then
    if to "$SSH_TIMEOUT" tailscale status >/dev/null 2>&1; then
      online=$(to "$SSH_TIMEOUT" tailscale status 2>/dev/null | grep -c -v 'offline' || true)
      row OK 0 remote "tailscale" "up (${online} pair(s) listes)"
    else
      row WARN 0 remote "tailscale" "down ou non authentifie"
    fi
  else
    row SKIP 0 remote "tailscale" "CLI absent"
  fi
elif want remote; then
  row SKIP 0 remote "--no-remote" "section serveurs sautee"
fi

# ============================================================================
#  5) MCP — claude mcp list (connected / failed)
# ============================================================================
if want mcp; then
  section "MCP (claude mcp list)"
  if command -v claude >/dev/null 2>&1; then
    # claude mcp list imprime: "<name>: <transport> - ✓ Connected" / "✗ Failed"
    mcp_out="$(to 30 claude mcp list 2>/dev/null || true)"
    if [[ -z "$mcp_out" ]]; then
      row WARN 0 mcp "claude mcp list" "aucune sortie (timeout?)"
    else
      # Une ligne de tableau par serveur, statut deduit du marqueur
      while IFS= read -r l; do
        [[ "$l" == *': '* ]] || continue
        name="${l%%:*}"
        if [[ "$l" == *'Connected'* || "$l" == *'✓'* ]]; then
          row OK 0 mcp "$name" "connecte"
        elif [[ "$l" == *'Failed'* || "$l" == *'✗'* ]]; then
          # figma-dev-mode (Figma desktop ferme) et supabase/codex souvent KO -> WARN, pas FAIL
          row WARN 0 mcp "$name" "DECONNECTE"
        fi
      done <<< "$mcp_out"
      # Rappel des serveurs attendus du projet
      for expect in figma-dev-mode playwright supabase cortex; do
        grep -qi "^${expect}:" <<< "$mcp_out" || row WARN 0 mcp "$expect" "non configure (~/.claude.json)"
      done
    fi
  else
    row SKIP 0 mcp "claude CLI" "absent du PATH"
  fi
fi

# ============================================================================
#  Bilan
# ============================================================================
printf '\n%s== Bilan ==%s\n' "$C_BOLD$C_CYAN" "$C_RESET"
total=${#ROWS[@]}
ok=0; for r in "${ROWS[@]}"; do [[ "${r%%$'\t'*}" == OK ]] && ok=$((ok+1)); done
printf '  %d verifications — %s%d OK%s, %s%d FAIL critiques%s, %s%d alertes%s\n' \
  "$total" "$C_GREEN" "$ok" "$C_RESET" "$C_RED" "$FAIL_CRIT" "$C_RESET" "$C_YEL" "$FAIL_SOFT" "$C_RESET"

if [[ "$FAIL_CRIT" -gt 0 ]]; then
  printf '  %sRESULTAT: FAIL — au moins une connexion CRITIQUE est cassee.%s\n' "$C_RED$C_BOLD" "$C_RESET"
  exit 1
fi
printf '  %sRESULTAT: OK — connexions critiques vivantes.%s\n' "$C_GREEN$C_BOLD" "$C_RESET"
exit 0
