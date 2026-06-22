#!/usr/bin/env bash
# api-sweep.sh — SAFE API surface sweep for Hearst Connect.
#
# Measures perf (time_total, TTFB) + disposition for GET endpoints, plus the
# ONE regex-nav cockpit-chat POST that short-circuits BEFORE any LLM call.
#
# NO LLM CALLS. Hard rule: the only POST we send is the regex-nav message
# "ouvre mon portefeuille", which matches LP_NAV_RULES (key: portfolio) in
# src/lib/llm/nav-fallback-intent.ts and returns NAV_SHORTCUT_ACK
# ("Je vous y emmène.") at route.ts:583 BEFORE runChatAgent / OpenAI.
#
# Usage:  BASE=http://localhost:4105 bash scripts/stress/api-sweep.sh
set -uo pipefail

BASE="${BASE:-http://localhost:4105}"
MAXT=60
# curl write-out: http_code time_total time_starttransfer size_download
WO='%{http_code} %{time_total} %{time_starttransfer} %{size_download}\n'

echo "=== Hearst Connect SAFE API sweep — base=$BASE ==="
echo

# --- GET endpoints (followed, -L) -------------------------------------------
# Each line: LABEL|METHOD|PATH
get_targets=(
  "health|GET|/api/health"
  "health-deep|GET|/api/health/deep"
  "search|GET|/api/search?q=vault"
  "chat-nav|GET|/api/chat-nav"
  "cockpit-chats|GET|/api/cockpit-chats"
  "admin-agents-graph|GET|/api/admin/agents/graph"
)

echo "--- GET endpoints (followed -L: final landing code) ---"
for t in "${get_targets[@]}"; do
  label="${t%%|*}"; rest="${t#*|}"; method="${rest%%|*}"; path="${rest#*|}"
  printf '%-22s ' "$label"
  curl -s -o /dev/null -w "$WO" -L --max-time "$MAXT" "$BASE$path"
done
echo

echo "--- GET endpoints (RAW, no -L: capture 3xx redirect = reject signal) ---"
for t in "${get_targets[@]}"; do
  label="${t%%|*}"; rest="${t#*|}"; method="${rest%%|*}"; path="${rest#*|}"
  printf '%-22s ' "$label"
  curl -s -o /dev/null -w "$WO" --max-time "$MAXT" "$BASE$path"
done
echo

# --- regex-nav cockpit-chat (the ONLY POST allowed) -------------------------
# Body verification: we DO capture the response body here because the contract
# is that it equals NAV_SHORTCUT_ACK exactly. text/plain stream, not JSON.
echo "--- cockpit-chat REGEX SHORT-CIRCUIT (zero LLM cost) ---"
printf '%-22s ' "cockpit-chat-regex"
curl -s -o /tmp/cockpit_regex_body.txt -w "$WO" --max-time "$MAXT" \
  -X POST "$BASE/api/cockpit-chat" \
  -H 'Content-Type: application/json' \
  -d '{"message":"ouvre mon portefeuille","messages":[]}'
echo "BODY: <<<$(cat /tmp/cockpit_regex_body.txt)>>>"
echo

echo "=== sweep complete ==="
