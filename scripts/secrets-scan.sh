#!/bin/bash
#
# scripts/secrets-scan.sh — secret-leak guard for Hearst Connect.
#
# WHAT IT DOES
#   (a) Prefers gitleaks > trufflehog if installed; else falls back to a curated
#       grep regex set (masked output only).
#   (b) Scans ONLY tracked files + the STAGED diff (git diff --cached). Never the
#       working tree at large, never gitignored files (.env.local is safe).
#   (c) NEVER prints the matched secret value — every hit is masked to
#       "<file>:<line>  [<rule>]  <first4>…<last2>" with the body redacted.
#   (d) Exits non-zero on any hit (blocks the commit when wired into pre-commit).
#
# USAGE
#   bash scripts/secrets-scan.sh            # scan staged diff + tracked files (default)
#   bash scripts/secrets-scan.sh --staged   # staged diff only (fast pre-commit path)
#   bash scripts/secrets-scan.sh --tracked  # all tracked files only
#   bash scripts/secrets-scan.sh --all      # both (explicit; same as default)
#
# IDEMPOTENT, read-only: it NEVER writes, stages, commits, or pushes anything.
# It never sources .env files and never echoes an env value.
#
set -euo pipefail

# --- repo root (path has a space AND an em-dash — always quote) -------------
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  printf '%s\n' "secrets-scan: not inside a git repo — aborting." >&2
  exit 2
fi
cd "$ROOT"

MODE="all"
case "${1:-}" in
  --staged)  MODE="staged" ;;
  --tracked) MODE="tracked" ;;
  --all|"")  MODE="all" ;;
  *) printf '%s\n' "secrets-scan: unknown flag '${1}'. Use --staged | --tracked | --all." >&2; exit 2 ;;
esac

# Aggregate hit flag. NOTE: scan_blob must NEVER be called through a pipe
# (a pipe runs it in a subshell and the FOUND mutation would be lost). Every
# caller passes content as an ARGUMENT and ORs the return status into FOUND.
FOUND=0

# --- masking helper: never reveal the secret ------------------------------
# Prints location + rule + a redacted fingerprint (first 4 / last 2 chars).
mask_hit() {
  # $1 = location label, $2 = rule name, $3 = raw matched token
  local loc="$1" rule="$2" tok="$3" head tail len
  len=${#tok}
  if [ "$len" -le 8 ]; then
    head="${tok:0:2}"; tail=""
  else
    head="${tok:0:4}"; tail="${tok: -2}"
  fi
  printf '  %s  [%s]  %s…%s  (len=%s, REDACTED)\n' "$loc" "$rule" "$head" "$tail" "$len" >&2
}

# --- curated regex rule set (name|ERE) ------------------------------------
# Detects the live-key shapes that leak in this ecosystem. Order: most specific first.
RULES=(
  'anthropic|sk-ant-[A-Za-z0-9_-]{20,}'
  'openai_proj|sk-proj-[A-Za-z0-9_-]{20,}'
  'openai|sk-[A-Za-z0-9]{20,}'
  'github_pat_classic|ghp_[A-Za-z0-9]{36}'
  'github_oauth|gho_[A-Za-z0-9]{36}'
  'vercel|vcp_[A-Za-z0-9]{24,}'
  'resend|(^|[^A-Za-z0-9_])re_[A-Za-z0-9_]{22,}'
  'hypercli|hyper_api_[A-Za-z0-9]{30,}'
  'langfuse_public|pk-lf-[A-Za-z0-9-]{20,}'
  'langfuse_secret|sk-lf-[A-Za-z0-9-]{20,}'
  'cloudflare_api|cfat_[A-Za-z0-9]{30,}'
  'cloudflare_tunnel|cfut_[A-Za-z0-9]{30,}'
  'aws_access_key|AKIA[0-9A-Z]{16}'
  'private_key_block|-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'jwt|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  'supabase_service_role|service_role[\"'\''[:space:]:=]+eyJ[A-Za-z0-9_.-]{30,}'
  # --- rest of Adrien's keychain (SERVICES.md) + classic distinctive shapes ---
  # Only PREFIX-anchored shapes (low false-positive). Bare-hex secrets without a
  # prefix (e.g. Deepgram's 40-hex) are deliberately NOT here: they would flag
  # every git SHA / content hash in the tree.
  'stripe|(sk|rk)_live_[A-Za-z0-9]{20,}'
  'elevenlabs|(^|[^A-Za-z0-9_/])sk_[A-Za-z0-9]{40,}'
  'inngest_signkey|signkey-(prod|test)-[a-f0-9]{40,}'
  'composio|(^|[^A-Za-z0-9_])ak_[A-Za-z0-9]{18,}'
  'fal|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32,}'
  'sentry_dsn|https://[0-9a-f]{32}@o[0-9]+\.ingest\.[A-Za-z0-9.]*sentry\.io'
  'axiom|(^|[^A-Za-z0-9_])xaat-[0-9a-f-]{24,}'
  'tailscale|tskey-[A-Za-z0-9-]{20,}'
  'google_api|AIza[0-9A-Za-z_-]{35}'
  'slack|xox[baprs]-[A-Za-z0-9-]{10,}'
  'upstash_token|UPSTASH[A-Z_]*TOKEN[\"'\''[:space:]:=]+[A-Za-z0-9_-]{30,}'
)

# Paths we never want to flag-on-self (this scanner contains the regexes above).
is_self() {
  case "$1" in
    scripts/secrets-scan.sh) return 0 ;;
    *) return 1 ;;
  esac
}

# Reviewed false positives — convention type `.gitleaksignore`. Chaque entrée =
# `sous-chaîne-de-chemin|rule`. N'ajouter ici qu'après inspection humaine (ces
# fichiers contiennent un PLACEHOLDER de doc/template, pas un vrai secret).
ALLOW=(
  'docs/vendor-onboarding/|private_key_block'   # gabarit DocuSign : "-----BEGIN ... KEY-----\n...\n-----END..."
)
is_allowed() { # $1 = label (chemin ou STAGED:chemin) ; $2 = rule
  local a apath arule
  for a in "${ALLOW[@]}"; do
    apath="${a%%|*}"; arule="${a#*|}"
    case "$1" in *"$apath"*) [ "$2" = "$arule" ] && return 0 ;; esac
  done
  return 1
}

# --- external-tool path (preferred) ---------------------------------------
run_gitleaks() {
  # gitleaks redacts by default; --no-banner keeps output clean. Non-zero on leak.
  if [ "$MODE" = "staged" ]; then
    gitleaks protect --staged --redact --no-banner 2>/dev/null
  else
    # 'detect --no-git' scans the tracked working files; redact masks values.
    gitleaks detect --no-git --redact --no-banner --source "$ROOT" 2>/dev/null
  fi
}

run_trufflehog() {
  # trufflehog filesystem mode; --fail makes it exit non-zero on a finding.
  # No --only-verified (would call out / no network), --no-update avoids self-mutation.
  trufflehog --no-update --fail filesystem "$ROOT" \
    --exclude-paths <(printf '%s\n' 'node_modules' '.git' 'release' 'releases' '.next') 2>/dev/null
}

if command -v gitleaks >/dev/null 2>&1; then
  printf '%s\n' "secrets-scan: using gitleaks (mode=$MODE)." >&2
  if run_gitleaks; then
    printf '%s\n' "secrets-scan: gitleaks clean." >&2
    exit 0
  else
    printf '%s\n' "secrets-scan: gitleaks reported potential secret(s) — commit blocked." >&2
    exit 1
  fi
elif command -v trufflehog >/dev/null 2>&1 && [ "$MODE" != "staged" ]; then
  # trufflehog has no first-class staged mode; only use it for tracked/all sweeps.
  printf '%s\n' "secrets-scan: using trufflehog (filesystem sweep)." >&2
  if run_trufflehog; then
    printf '%s\n' "secrets-scan: trufflehog clean." >&2
    exit 0
  else
    printf '%s\n' "secrets-scan: trufflehog reported potential secret(s) — commit blocked." >&2
    exit 1
  fi
fi

# --- fallback: curated grep (masked) --------------------------------------
printf '%s\n' "secrets-scan: gitleaks/trufflehog absent — using curated regex fallback (mode=$MODE)." >&2

# Scans the supplied content. Returns 0 = clean, 1 = at least one hit.
# Content is passed as $2 (NO pipe — must run in the caller's shell so the
# caller can capture the return status; we never rely on a global mutation here).
scan_blob() {
  # $1 = location label (file or 'STAGED:file'); $2 = content blob.
  local label="$1" content="$2" line rule pat tok lno entry hit=0
  for entry in "${RULES[@]}"; do
    rule="${entry%%|*}"
    pat="${entry#*|}"
    is_allowed "$label" "$rule" && continue   # FP relue (placeholder doc/template)
    # -n: line numbers, -E: ERE, -o: only the match (so we can mask it).
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      lno="${line%%:*}"
      tok="${line#*:}"
      mask_hit "${label}:${lno}" "$rule" "$tok"
      hit=1
    done < <(printf '%s\n' "$content" | grep -noE -e "$pat" || true)
  done
  return "$hit"
}

scan_staged() {
  # Only ADDED lines in the staged diff (prefix '+'), excluding the +++ header.
  local files f added
  files="$(git diff --cached --name-only --diff-filter=ACM)"
  [ -z "$files" ] && return 0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    is_self "$f" && continue
    added="$(git diff --cached --unified=0 -- "$f" | grep -E '^\+' | grep -vE '^\+\+\+' | sed 's/^\+//' || true)"
    [ -z "$added" ] && continue
    if ! scan_blob "STAGED:${f}" "$added"; then FOUND=1; fi
  done < <(printf '%s\n' "$files")
}

scan_tracked() {
  local f content sz
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    is_self "$f" && continue
    [ -f "$f" ] || continue
    case "$f" in
      *.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.ico|*.svg|*.woff|*.woff2|*.ttf|*.otf|\
      *.lock|*.tgz|*.tar|*.gz|*.zip|*.dmg|*.exe|*.db|*.tsbuildinfo|\
      pnpm-lock.yaml|package-lock.json|yarn.lock) continue ;;
    esac
    # Skip binaries: `grep -I` treats binary files as non-matching -> returns 1.
    grep -Iq . -- "$f" 2>/dev/null || continue
    # Skip large/generated files (lockfiles, dumps); secrets live in source/config.
    sz="$(wc -c < "$f" 2>/dev/null || echo 0)"
    [ "${sz:-0}" -gt 262144 ] && continue
    content="$(cat -- "$f")"
    if ! scan_blob "$f" "$content"; then FOUND=1; fi
  done < <(git ls-files)
}

case "$MODE" in
  staged)  scan_staged ;;
  tracked) scan_tracked ;;
  all)     scan_staged; scan_tracked ;;
esac

if [ "$FOUND" -ne 0 ]; then
  printf '%s\n' "secrets-scan: potential secret(s) detected above (values redacted) — commit blocked." >&2
  printf '%s\n' "  → If false positive, remove/parametrise the value or bypass once with: git commit --no-verify" >&2
  exit 1
fi

printf '%s\n' "secrets-scan: clean." >&2
exit 0
