#!/usr/bin/env bash
# DS utility-class audit — allowlist from cockpit.css + globals.css (ADR-013).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFINED="$(mktemp)"
USED="$(mktemp)"
VAR_ONLY="$(mktemp)"
trap 'rm -f "$DEFINED" "$USED" "$VAR_ONLY"' EXIT

# ── 1. Allowlist: classes defined in canonical CSS sources ─────────────────
rg -o '\.ct-[a-z][a-z0-9_-]*|@utility ct-[a-z][a-z0-9_-]*' \
  src/app/cockpit.css \
  src/app/globals.css \
  src/app/\(product\)/portfolio/portfolio.css \
  | sed 's/.*://;s/^\.//;s/@utility //' \
  | sort -u >"$DEFINED"

# Typo roles (not ct-* but allowed in className — see ds-typo)
TYPO_ROLES="h1 h2 h3 h4 eyebrow stat-value stat-label body-lg body-md body-sm body-xs mono tabular prose-spec"

# ── 2. Used ct-* tokens in TS/TSX (includes src/lib/ui helpers) ────────────
rg -o '\bct-[a-z][a-z0-9_-]+\b' \
  src/app src/components src/lib/ui \
  --glob '*.{tsx,ts}' \
  | sed 's/.*://' \
  | sort -u >"$USED"

# ── 3. Names that are CSS vars / arbitrary-value tokens, not utility classes
cat >"$VAR_ONLY" <<'EOF'
ct-accent
ct-accent-maroon
ct-accent-soft
ct-accent-strong
ct-border
ct-dur-base
ct-dur-fast
ct-dur-shimmer
ct-dur-slow
ct-dur-slower
ct-ease
ct-glow
ct-glow-dot
ct-glow-subtle
ct-graphite-active-bg
ct-graphite-border
ct-leading-relaxed
ct-product-connect
ct-shadow-focus-ring
ct-space
ct-space-1
ct-space-2
ct-status-danger-border
ct-status-info-border
ct-status-success-border
ct-status-warning-border
ct-z-base
ct-z-dropdown
ct-z-modal
ct-z-overlay
ct-z-popover
ct-z-raised
ct-chart-empty-h
ct-donut-size
ct-rail
EOF

is_var_only() {
  grep -qxF "$1" "$VAR_ONLY"
}

is_defined() {
  grep -qxF "$1" "$DEFINED"
}

echo "🎨 DS Utility Classes Audit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Allowlist: $(wc -l <"$DEFINED" | tr -d ' ') classes (cockpit.css + globals.css + portfolio.css)"
echo "Scanned : src/app, src/components, src/lib/ui"
echo ""

# ── 4. Undefined ct-* class usages ─────────────────────────────────────────
UNDEFINED=()
while IFS= read -r cls; do
  is_var_only "$cls" && continue
  is_defined "$cls" || UNDEFINED+=("$cls")
done <"$USED"

if ((${#UNDEFINED[@]} == 0)); then
  echo "✅ No undefined ct-* class usages"
else
  echo "❌ Undefined ct-* classes (${#UNDEFINED[@]}):"
  printf '   %s\n' "${UNDEFINED[@]}" | sort -u
fi
echo ""

# ── 5. ADR-013 deprecated surfaces (new code must not add these) ───────────
echo "⚠️  DEPRECATED surface classes (migration targets, ADR-013):"
# Word-boundary on glass-panel avoids matching ct-glass-panel
DEPRECATED_RE='\bglass-panel\b|glass-panel-subtle|\bct-system-panel\b|admin-doc-flat-list|admin-vault-list-card'
DEP_HITS="$(rg -n "$DEPRECATED_RE" src/app src/components \
  --glob '*.{tsx,ts}' \
  --glob '!**/__tests__/**' \
  --glob '!**/*.test.{tsx,ts}' \
  2>/dev/null | rg -v '//|ct-glass-panel|\* ' || true)"
if [[ -z "${DEP_HITS:-}" ]]; then
  echo "   (none in ts/tsx)"
else
  echo "$DEP_HITS" | head -30
  DEP_COUNT="$(echo "$DEP_HITS" | wc -l | tr -d ' ')"
  [[ "$DEP_COUNT" -gt 30 ]] && echo "   … and $((DEP_COUNT - 30)) more"
fi
echo ""

# ── 6. Token syntax convention (not ESLint-enforced) ───────────────────────
echo "📐 Token syntax in admin + lib/ui:"
V4_COUNT="$(rg -c '\(--ct-' src/app/admin src/components/admin src/lib/ui --glob '*.{tsx,ts}' 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')"
BRACKET_COUNT="$(rg -c '\[var\(--ct-' src/app/admin src/components/admin src/lib/ui --glob '*.{tsx,ts}' 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')"
echo "   border/bg/text-(--ct-*)     : $V4_COUNT occurrences (legacy OK, avoid new)"
echo "   border/bg/text-[var(--ct-*)] : $BRACKET_COUNT occurrences (canon for new admin code)"
echo ""

# ── 7. Helpers outside page files ──────────────────────────────────────────
echo "📦 src/lib/ui/ class strings:"
rg -n '.' src/lib/ui/*.ts 2>/dev/null || echo "   (none)"
echo ""

# ── 8. Exit code ───────────────────────────────────────────────────────────
if ((${#UNDEFINED[@]} > 0)); then
  echo "Verdict: FAIL — undefined ct-* classes above need cockpit.css definition or rename."
  exit 1
fi
echo "Verdict: PASS — all ct-* class usages match CSS allowlist."
exit 0
