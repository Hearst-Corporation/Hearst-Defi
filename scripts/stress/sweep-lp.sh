#!/usr/bin/env bash
# sweep-lp.sh
# Sweep EVERY LP + public page as the dev investor (LP) against the LIVE local
# dev server (http://localhost:4105, DEV_AUTH_BYPASS=1, NODE_ENV=development).
#
# For each route we do TWO curl probes:
#   1) NON-followed (no -L): captures the RAW status. A 3xx here is the reject
#      signal (e.g. admin pages redirecting an LP to /login).
#   2) Followed (-L): captures the FINAL landing status + perf numbers after
#      any redirect chain resolves.
#
# Each route is WARMED once (discarded) before the measured hit, so cold Next.js
# Turbopack compile time does not pollute the reported latency. We report the
# 2nd (warm) hit. Warming applies to both the raw and followed probes.
#
# Captured per route (warm hit): rawCode, followedCode, time_total (s),
# time_starttransfer / TTFB (s), size_download (bytes), redirect_url (raw).
#
# Read-only against the app: GET only, no POST, no LLM. Writes nothing into the
# codebase. Output is machine-parseable TSV on stdout (one line per route).
#
# Output columns (tab-separated):
#   path  rawCode  followedCode  time_total  time_starttransfer  size_download  redirect_url

set -u

BASE="${BASE:-http://localhost:4105}"
MAX_TIME=60

# All LP + public routes to sweep, including concrete dynamic ones.
# Dynamic ids confirmed real:
#   vaultSlug (investor) = yield  -> /vaults/yield , /vaults/yield/invest
#   positionId           = DEV_POSITION_ID env (real) -> /portfolio/<positionId>
# Empty-DB dynamic routes (AgentTemplate/GovernanceProposal/OutreachCampaign) are
# admin-only and excluded from the LP sweep anyway.
POSITION_ID="${DEV_POSITION_ID:-}"

ROUTES=(
  "/"
  "/login"
  "/apply"
  "/apply/confirmed"
  "/forgot-password"
  "/legal"
  "/legal/disclaimer"
  "/legal/privacy"
  "/legal/terms"
  "/onboarding"
  "/onboarding/accreditation"
  "/onboarding/identity"
  "/onboarding/wallet"
  "/portfolio"
  "/portfolio/positions"
  "/portfolio/activity"
  "/portfolio/distributions"
  "/portfolio/yield"
  "/portfolio/tax"
  "/profile"
  "/proof-center"
  "/proof-center/full"
  "/vaults"
  "/vaults/yield"
  "/vaults/yield/invest"
)

# Append concrete position drill-down only if we have a real id.
if [ -n "$POSITION_ID" ]; then
  ROUTES+=("/portfolio/${POSITION_ID}")
fi

# raw probe: NO -L. Emits "<http_code> <redirect_url>"
# Retries on 000 (connection refused/reset while Turbopack recompiles) up to
# RETRIES times with a short backoff, so a transient dev-server stall does not
# get mis-recorded as a route failure.
RETRIES="${RETRIES:-4}"
probe_raw() {
  local url="$1" out code attempt=0
  while :; do
    out="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' \
      --connect-timeout 10 --max-time "$MAX_TIME" "$url")"
    code="$(printf '%s' "$out" | awk '{print $1}')"
    if [ "$code" != "000" ] || [ "$attempt" -ge "$RETRIES" ]; then
      printf '%s' "$out"
      return 0
    fi
    attempt=$(( attempt + 1 ))
    perl -e 'select(undef,undef,undef,0.6)'   # 600ms backoff, no foreground sleep
  done
}

# followed probe: -L. Emits "<http_code> <time_total> <time_starttransfer> <size_download>"
probe_followed() {
  local url="$1" out code attempt=0
  while :; do
    out="$(curl -s -o /dev/null \
      -w '%{http_code} %{time_total} %{time_starttransfer} %{size_download}' \
      -L --connect-timeout 10 --max-time "$MAX_TIME" "$url")"
    code="$(printf '%s' "$out" | awk '{print $1}')"
    if [ "$code" != "000" ] || [ "$attempt" -ge "$RETRIES" ]; then
      printf '%s' "$out"
      return 0
    fi
    attempt=$(( attempt + 1 ))
    perl -e 'select(undef,undef,undef,0.6)'
  done
}

printf 'SWEEP_START\n'
printf 'path\trawCode\tfollowedCode\ttime_total\ttime_starttransfer\tsize_download\tredirect_url\n'

for route in "${ROUTES[@]}"; do
  url="${BASE}${route}"

  # --- WARM (discard): compile both code paths once. ---
  probe_raw "$url" >/dev/null 2>&1
  probe_followed "$url" >/dev/null 2>&1

  # --- MEASURED (warm) raw probe. ---
  raw_out="$(probe_raw "$url")"
  raw_code="$(printf '%s' "$raw_out" | awk '{print $1}')"
  redirect_url="$(printf '%s' "$raw_out" | awk '{print $2}')"
  [ -z "$redirect_url" ] && redirect_url="-"

  # --- MEASURED (warm) followed probe. ---
  fol_out="$(probe_followed "$url")"
  fol_code="$(printf '%s' "$fol_out" | awk '{print $1}')"
  t_total="$(printf '%s' "$fol_out" | awk '{print $2}')"
  t_ttfb="$(printf '%s' "$fol_out" | awk '{print $3}')"
  sz="$(printf '%s' "$fol_out" | awk '{print $4}')"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$route" "$raw_code" "$fol_code" "$t_total" "$t_ttfb" "$sz" "$redirect_url"
done

printf 'SWEEP_END\n'
