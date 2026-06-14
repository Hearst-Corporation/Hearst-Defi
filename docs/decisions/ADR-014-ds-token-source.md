# ADR-014: Design System Token Source of Truth

**Status:** Accepted  
**Date:** 2026-06-14

## Context

`@hearst/cockpit-shell` v0.2.1 is vendored as a local tarball (`file:./hearst-cockpit-shell-0.2.1.tgz`). The package was built from a maroon-era codebase and contains stale tokens including:

- `--ct-accent: #8A1538` (maroon brand, WRONG)
- `--ct-bg-deep: #1A050B` (maroon-tinted near-black, WRONG)
- `--ct-rail-left: 88px`, `--ct-rail-right: 420px` (stale layout)
- `--ct-surface-0/1/2/3` at 0.02/0.04/0.06/0.09 opacity (too dim on pure black)
- `--ct-text-muted: rgba(245,245,245,0.48)` (fails WCAG AA on #000000)
- `--ct-dur-base: 180ms` (stale)
- `--ct-shadow-depth` (stale recipe)

`src/app/cockpit.css` overrides 13 of these tokens via unlayered `:root` rules. The `--ct-accent` override specifically uses `!important` to guarantee it wins over any ThemeAccent injection from the package.

A token drift audit (`scripts/ds-token-drift.mjs`) confirmed 13 divergences, all intentional and documented in `scripts/ds-token-allowlist.json`.

The CI gate (`scripts/ds-layout-audit.mjs`) previously scanned a `package/tokens.css` path that does not exist in the installed tree, creating a silent blind spot for maroon detection in the actual package. This has been corrected to scan `node_modules/@hearst/cockpit-shell/tokens.css` (the real resolved path).

## Decision

**`src/app/cockpit.css` is the effective runtime source of truth for all `--ct-*` tokens** until the tarball is rebuilt with green-era values.

Consequences:

1. The overrides in `cockpit.css` MUST NOT be removed without a verified tarball rebuild.
2. Removing `--ct-accent: #A7FB90 !important` without a tarball update is a P0 brand regression (reverts to maroon `#8A1538`).
3. All 13 divergences in `scripts/ds-token-allowlist.json` are the canonical record of known stale-vs-runtime mismatches.
4. New tokens (anything not in the package) should be added to `cockpit.css` only.

## Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Removing any `!important` in cockpit.css without tarball rebuild | P0 — brand reverts to maroon | Never remove without rebuild; ADR-014 is the gate |
| Agent adds a token to cockpit.css that conflicts with a future package update | Low | `ds-token-drift.mjs` will flag it as unexpected-drift |
| Package maroon tokens bypassing cockpit.css (e.g. server-rendered CSS-in-JS) | Medium | `ds-layout-audit.mjs` now scans the real package path and warns |

## Next Steps

1. Rebuild `@hearst/cockpit-shell` with green tokens (replace `#8A1538` → `#A7FB90`, `#1A050B` → `#000000`, update all derivatives).
2. After verifying the new tarball resolves correctly, systematically remove each allowlisted override from `cockpit.css`.
3. Remove entries from `ds-token-allowlist.json` as each override is eliminated.
4. Target: reduce the `!important` count in `cockpit.css` from ~49 to 0.

## References

- `scripts/ds-token-drift.mjs` — token divergence reporter
- `scripts/ds-token-allowlist.json` — canonical allowlist of expected overrides
- `scripts/ds-layout-audit.mjs` — CI gate (includes maroon guard on real package path)
- `src/app/cockpit.css` — effective runtime token source
- `node_modules/@hearst/cockpit-shell/tokens.css` — stale package (maroon era)
- ADR-013 — design system canon (glass panels)
