#!/usr/bin/env bash
# stress-http-nav.sh
# Stress the LIVE local cockpit-chat endpoint via the REGEX-ONLY nav short-circuit.
# This path returns 200 + a fixed ack ("Je vous y emmène.") BEFORE any LLM call,
# so it costs ZERO OpenAI tokens. Rate limit is 20 req / 60000ms per user, so a
# burst of N=60 is expected to hit 429 after ~20 (that is correct behaviour).
#
# Output: one "CODE TIME" line per request (HTTP status + curl time_total in s),
# plus a captured copy of the first 200 body for ack verification.
# Read-only against the app: writes nothing into the codebase, only /tmp scratch.

set -u

URL="http://localhost:4105/api/cockpit-chat"
N="${1:-60}"
BODY_TMP="/tmp/stress-body-$$"        # rotating per-request body sink
FIRST200_TMP="/tmp/stress-first200-$$" # first 200 body, kept for verification

# Rotating set of LP regex nav messages (all match resolveLpNavDestinationKey).
MESSAGES=(
  "ouvre mon portefeuille"
  "va sur mes distributions"
  "montre-moi ma fiscalité"
  "open proof center"
  "affiche mon rendement"
  "go to vaults"
)

captured_first200=0

i=0
while [ "$i" -lt "$N" ]; do
  msg="${MESSAGES[$(( i % ${#MESSAGES[@]} ))]}"
  # JSON body: {"message":"<msg>","messages":[]}
  payload=$(printf '{"message":"%s","messages":[]}' "$msg")

  # %{http_code} %{time_total} -> "200 0.012345"
  read -r code time_total < <(
    curl -sS \
      -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -o "$BODY_TMP" \
      -w "%{http_code} %{time_total}\n"
  )

  # Keep the first 200 body so the caller can confirm it equals the ack.
  if [ "$code" = "200" ] && [ "$captured_first200" -eq 0 ]; then
    cp "$BODY_TMP" "$FIRST200_TMP" 2>/dev/null || true
    captured_first200=1
  fi

  # Emit "CODE TIME" so latencies can be aggregated downstream.
  printf '%s %s\n' "$code" "$time_total"

  i=$(( i + 1 ))
done

# Surface the first 200 body verbatim for the ack check.
if [ "$captured_first200" -eq 1 ]; then
  printf 'FIRST200_BODY_START\n'
  cat "$FIRST200_TMP"
  printf '\nFIRST200_BODY_END\n'
else
  printf 'FIRST200_BODY_START\n(no 200 captured)\nFIRST200_BODY_END\n'
fi

# Cleanup scratch.
rm -f "$BODY_TMP" "$FIRST200_TMP" 2>/dev/null || true
