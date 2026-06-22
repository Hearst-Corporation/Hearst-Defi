#!/usr/bin/env bash
# api-sweep-samples.sh — repeated-sample harness for percentile computation.
# Emits CSV: label,iter,code,time_total,ttfb,size  (one row per request).
# GET endpoints only. NO LLM CALLS.
set -uo pipefail
BASE="${BASE:-http://localhost:4106}"
N="${N:-10}"
WO='%{http_code} %{time_total} %{time_starttransfer} %{size_download}'

paths=(
  "/api/health"
  "/api/health/deep"
  "/api/search?q=vault"
  "/api/chat-nav"
  "/api/cockpit-chats"
  "/api/admin/agents/graph"
)
labels=(health health-deep search chat-nav cockpit-chats admin-agents-graph)

echo "label,iter,code,time_total,ttfb,size"
i=0
while [ $i -lt ${#paths[@]} ]; do
  n=1
  while [ $n -le "$N" ]; do
    line=$(curl -s -o /dev/null -w "$WO" --max-time 60 "$BASE${paths[$i]}")
    echo "${labels[$i]},$n,$(echo "$line" | tr ' ' ',')"
    n=$((n+1))
  done
  i=$((i+1))
done
