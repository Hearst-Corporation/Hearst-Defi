#!/usr/bin/env bash
# admin-as-lp.sh
# Access-control sweep: hit EVERY admin route as the dev investor (LP) while
# DEV_AUTH_BYPASS=1 seeds an `investor`-role session. The /admin layout gate
# (src/app/admin/layout.tsx) must REJECT non-admins via notFound() (404).
#
# For each route we capture two passes:
#   raw  : no -L  -> the raw status (3xx redirect OR 404). This is the reject signal.
#   foll : with -L -> the final landing code after following redirects.
#
# Metrics from curl -w: http_code, time_total, time_starttransfer (TTFB),
# size_download (bytes). REAL numbers only.
#
# Output: one TSV line per route to stdout:
#   path  rawCode  followedCode  time_total  ttfb  size
#
# Usage: bash scripts/stress/admin-as-lp.sh
set -u

BASE="${BASE:-http://localhost:4105}"
TIMEOUT="${TIMEOUT:-60}"

ROUTES=(
  "/admin"
  "/admin/dashboard"
  "/admin/agents"
  "/admin/agents/new"
  "/admin/audit"
  "/admin/customers"
  "/admin/distributions"
  "/admin/feedback"
  "/admin/governance"
  "/admin/governance/allowlist"
  "/admin/governance/propose"
  "/admin/investor-memo"
  "/admin/monitoring"
  "/admin/onboarding-test"
  "/admin/outreach"
  "/admin/outreach/compose"
  "/admin/product-workspace"
  "/admin/projection"
  "/admin/proof-center"
  "/admin/proof-center/full"
  "/admin/proofs"
  "/admin/roadmap"
  "/admin/scenario-lab"
  "/admin/security"
  "/admin/signals"
  "/admin/spec"
  "/admin/vaults"
  "/admin/vaults/new"
)

printf "path\trawCode\tfollowedCode\ttime_total\tttfb\tsize\n"
for path in "${ROUTES[@]}"; do
  url="${BASE}${path}"

  # RAW pass: do NOT follow redirects -> captures the 3xx OR 404 reject signal.
  raw=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url")

  # FOLLOWED pass: follow redirects -> final landing code + real timings.
  foll=$(curl -s -o /dev/null -w "%{http_code} %{time_total} %{time_starttransfer} %{size_download}" -L --max-time "$TIMEOUT" "$url")

  fcode=$(printf "%s" "$foll" | awk '{print $1}')
  ttot=$(printf  "%s" "$foll" | awk '{print $2}')
  ttfb=$(printf  "%s" "$foll" | awk '{print $3}')
  size=$(printf  "%s" "$foll" | awk '{print $4}')

  printf "%s\t%s\t%s\t%s\t%s\t%s\n" "$path" "$raw" "$fcode" "$ttot" "$ttfb" "$size"
done
