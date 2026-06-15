# ADR-014: Design System Token Source of Truth

**Status:** Accepted (amended 2026-06-15)  
**Date:** 2026-06-14

## Context

`@hearst/cockpit-shell` was originally vendored as a local tarball with a maroon-era
token set. Commit `1049eee` **dé-vendored** the shell into `cockpit-shell/` (editable
local copy, green canon `#A7FB90` / `#000000`). Imports resolve via `tsconfig` paths
and `vitest` aliases — there is no runtime dependency on `node_modules/@hearst/cockpit-shell`.

`src/app/cockpit.css` still overrides **11** tokens from the shell base for product-specific
calibration (surfaces, rails, muted text, shadow, duration). These are documented in
`scripts/ds-token-allowlist.json` and enforced by `scripts/ds-token-drift.mjs`.

`scripts/ds-layout-audit.mjs` scans `cockpit-shell/` for maroon re-entry and layout
anti-patterns. Maroon in the local DS copy is a **violation**, not an excused stale package.

## Decision

**Two-layer token model:**

1. **`cockpit-shell/tokens.css`** — editable DS base (green brand, shell layout primitives).
2. **`src/app/cockpit.css`** — project runtime overrides for the 11 allowlisted divergences.

Consequences:

1. Edit shell tokens in `cockpit-shell/tokens.css`; edit product overrides in `cockpit.css`.
2. New divergences must be added to `ds-token-allowlist.json` or CI fails.
3. The duplicate `package/` tree (old shell build artifact) is **removed** — do not reintroduce.
4. `--ct-accent` in `cockpit-shell/tokens.css` must stay `#A7FB90`; maroon is P0 regression.

## Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Maroon re-entering `cockpit-shell/` | P0 | `ds-layout-audit.mjs` maroon guard on `cockpit-shell/` |
| Unallowlisted drift between shell and cockpit.css | Medium | `ds-token-drift.mjs` in lint pipeline |
| Re-vendoring a tarball alongside `cockpit-shell/` | Medium | ADR-014 + README; single source in repo |

## Next Steps

1. Gradually eliminate allowlisted overrides by aligning `cockpit-shell/tokens.css` with runtime needs.
2. Remove entries from `ds-token-allowlist.json` as each override is retired.
3. Target: reduce `!important` usage in `cockpit.css` as overrides shrink.

## References

- `cockpit-shell/tokens.css` — editable DS base
- `src/app/cockpit.css` — runtime override layer
- `scripts/ds-token-drift.mjs` — divergence reporter
- `scripts/ds-token-allowlist.json` — canonical allowlist
- `scripts/ds-layout-audit.mjs` — CI gate (maroon + layout)
- ADR-013 — design system canon (glass panels)
