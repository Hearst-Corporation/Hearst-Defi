#!/usr/bin/env bash
# verify-live-4105.sh — independent live re-verification of the stress dataset.
# Read-only. GET pages + lightweight endpoints + the ONE regex-nav cockpit-chat
# (short-circuits before the LLM). NEVER hits OpenAI. No commit/push.
#
# Usage: bash scripts/stress/verify-live-4105.sh
# Captures: http_code time_total ttfb size_download   (curl -w, real numbers)
set -u
BASE="${BASE:-http://localhost:4105}"
W='%{http_code} %{time_total} %{time_starttransfer} %{size_download}\n'

hit_raw()  { curl -s -o /dev/null -w "$W"      --max-time 60    "$BASE$1"; }   # no -L (raw 3xx)
hit_foll() { curl -s -o /dev/null -w "$W"   -L --max-time 60    "$BASE$1"; }   # follow redirects
redir()    { curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' --max-time 30 "$BASE$1"; }

echo "### server"
echo -n "/api/health -> "; curl -s --max-time 15 "$BASE/api/health"; echo

echo "### access-control: admin routes as LP (expect REJECT; 200 == P0 leak)"
for u in /admin /admin/dashboard /admin/customers /admin/security /admin/vaults \
         /admin/governance/allowlist /admin/outreach; do
  printf "%-30s raw=" "$u"; hit_raw "$u" | tr -d '\n'; printf "  foll="; hit_foll "$u"
done
echo -n "BASELINE /admin/zzz-bogus-xyz (expect 404) raw="; hit_raw /admin/zzz-bogus-xyz

echo "### dynamic LP routes (dataset reported 500 on the OTHER server :4106)"
for u in /vaults/yield /vaults/yield/invest /portfolio/cmqlr56xp0000qgdvccs4lwky; do
  printf "%-45s " "$u"; hit_raw "$u"
done

echo "### perf: heaviest warm route"
printf "/portfolio warm "; hit_foll /portfolio

echo "### redirect signal"
redir /admin/scenario-lab

echo "### api reject probes (expect 403 for LP)"
printf "/api/search?q=vault       "; hit_raw "/api/search?q=vault"
printf "/api/admin/agents/graph   "; hit_raw "/api/admin/agents/graph"

echo "### regex cockpit-chat (SAFE — short-circuits before LLM)"
B=$(curl -s --max-time 30 -X POST "$BASE/api/cockpit-chat" \
      -H 'Content-Type: application/json' -d '{"message":"ouvre mon portefeuille"}')
printf 'ack=<<<%s>>>\n' "$B"
