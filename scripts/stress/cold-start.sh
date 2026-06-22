#!/usr/bin/env bash
# Cold-start latency probe.
# The dev server is warm globally, but Turbopack compiles each route on its
# FIRST request. So the first hit per route IS the cold/first-compile time.
# Then 3 warm hits -> median. ratio = cold/warm.
# Also captures raw 3xx (no -L) to expose admin reject-as-LP redirects.
set -u
BASE="http://localhost:4105"

ROUTES=(
  "/"
  "/login"
  "/apply"
  "/legal"
  "/portfolio"
  "/portfolio/distributions"
  "/portfolio/tax"
  "/vaults"
  "/proof-center"
  "/profile"
  "/admin/dashboard"
  "/admin/scenario-lab"
)

median3() {
  # args: three numbers -> median
  printf '%s\n' "$1" "$2" "$3" | sort -n | sed -n '2p'
}

echo "path|coldCode|coldMs|rawCode|warm1|warm2|warm3|warmMs|ratio"
for r in "${ROUTES[@]}"; do
  url="$BASE$r"

  # raw (no -L) code = the 3xx reject signal if any
  raw=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "$url")

  # COLD: first compile (followed)
  cold=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" -L --max-time 60 "$url")
  ccode=$(echo "$cold" | cut -d' ' -f1)
  cts=$(echo "$cold" | cut -d' ' -f2)

  # WARM x3 (followed)
  w1=$(curl -s -o /dev/null -w "%{time_total}" -L --max-time 60 "$url")
  w2=$(curl -s -o /dev/null -w "%{time_total}" -L --max-time 60 "$url")
  w3=$(curl -s -o /dev/null -w "%{time_total}" -L --max-time 60 "$url")
  wmed=$(median3 "$w1" "$w2" "$w3")

  ratio=$(awk -v c="$cts" -v w="$wmed" 'BEGIN{ if (w>0) printf "%.2f", c/w; else printf "NA" }')

  echo "$r|$ccode|$cts|$raw|$w1|$w2|$w3|$wmed|$ratio"
done
